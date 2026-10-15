// The CLI entry point and command dispatch.
//
// IMPLEMENTATION (Architecture): the entry point is a function
// `(argv, cwd, stdout, stderr) → exit code`; the bin (`bin.ts`) is a trivial
// wrapper around it. SPEC 12.0: exit codes partition all outcomes — 0
// success, 1 findings, 2 usage and configuration errors; reports are
// standard-output content, usage and configuration error messages and all
// other diagnostic text standard-error content.
//
// Command modules load on demand (dynamic import per dispatch), and the
// configuration parser (workspace/config.ts, on the TypeScript compiler)
// loads once the configuration is located. Every workspace-bound command
// takes the one path: parse and validate the configuration (SPEC 7, 14.14),
// then dispatch. No read answers from stored graph data on the strength of
// recorded inputs: `query` and `at` analyze the current sources and compare
// the store with what this build derives from them, refreshing it on a
// passing workspace before answering (SPEC 13.3, 11.2: read results never
// come from stale data — a comparison of content, which no recorded input
// fingerprint or recorded parse can stand in for).

import type { ExitCode } from "../core/findings.js";
import { CodedRefusal } from "../workspace/environment-refusal.js";
import { locateWorkspace } from "../workspace/locate.js";
import type { Invocation } from "./args.js";
import { COMMAND_PATHS, jsonOutputInEffect, parseArgv } from "./args.js";
import type { CliWriter, CommandContext } from "./io.js";
import {
  emitCodedRefusal,
  emitConfigurationErrors,
  emitErrorDocument,
  usageErrorFinding,
} from "./report.js";

/** One command's implementation, dispatched by `Invocation.command`. */
export type CommandHandler = (
  invocation: Invocation,
  context: CommandContext,
) => Promise<ExitCode>;

/**
 * The dispatch table: one lazily imported handler per SPEC 12.5 command
 * path, so an invocation loads only its own command's implementation.
 * `version` (SPEC 12.6) is absent by design: it loads no configuration and
 * consults no workspace, so `main` dispatches it before workspace location,
 * upstream of this workspace-bound table.
 */
const HANDLERS: ReadonlyMap<string, () => Promise<CommandHandler>> = new Map(
  COMMAND_PATHS.filter((path) => path !== "version").map(
    (path): [string, () => Promise<CommandHandler>] => {
      switch (path) {
        case "build":
          // SPEC 12.1.
          return [
            path,
            async () => (await import("./commands/build.js")).buildCommand,
          ];
        case "check":
          // SPEC 12.2.
          return [
            path,
            async () => (await import("./commands/check.js")).checkCommand,
          ];
        case "ids":
          // SPEC 12.3.
          return [
            path,
            async () => (await import("./commands/ids.js")).idsCommand,
          ];
        case "show":
          // SPEC 12.4.
          return [
            path,
            async () => (await import("./commands/show.js")).showCommand,
          ];
        case "coverage":
          // SPEC 8.2.
          return [
            path,
            async () =>
              (await import("./commands/coverage.js")).coverageCommand,
          ];
        case "impact":
          // SPEC 9.
          return [
            path,
            async () => (await import("./commands/impact.js")).impactCommand,
          ];
        case "query node":
        case "query nodes":
        case "query edges":
        case "query subtree":
        case "query ancestors":
        case "query reachable":
          // SPEC 11.
          return [
            path,
            async () => (await import("./commands/query.js")).queryCommand,
          ];
        case "review create":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review.js")).reviewCreateCommand,
          ];
        case "review list":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review.js")).reviewListCommand,
          ];
        case "review status":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review.js")).reviewStatusCommand,
          ];
        case "review next":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review.js")).reviewNextCommand,
          ];
        case "review show":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review.js")).reviewShowCommand,
          ];
        case "review split":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review-mutate.js")).reviewSplitCommand,
          ];
        case "review resolve":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review-mutate.js"))
                .reviewResolveCommand,
          ];
        case "review export":
          // SPEC 10.7.
          return [
            path,
            async () =>
              (await import("./commands/review.js")).reviewExportCommand,
          ];
        case "occurrences":
          // SPEC 11.3.
          return [
            path,
            async () =>
              (await import("./commands/occurrences.js")).occurrencesCommand,
          ];
        case "view":
          // SPEC 11.4.
          return [
            path,
            async () => (await import("./commands/view.js")).viewCommand,
          ];
        case "at":
          // SPEC 11.5.
          return [
            path,
            async () => (await import("./commands/at.js")).atCommand,
          ];
        case "inventory":
          // SPEC 11.6.
          return [
            path,
            async () =>
              (await import("./commands/inventory.js")).inventoryCommand,
          ];
        case "rename":
          // SPEC 6.4.
          return [
            path,
            async () => (await import("./commands/rename.js")).renameCommand,
          ];
        case "move":
          // SPEC 6.5.
          return [
            path,
            async () => (await import("./commands/move.js")).moveCommand,
          ];
        default:
          // Unreachable: every workspace-bound SPEC 12.5 command path is
          // cased above. Guarded so a command-table addition without a
          // handler fails loudly at module load.
          throw new Error(`no handler implemented for command '${path}'`);
      }
    },
  ),
);

/**
 * The CLI entry: parse per SPEC 12.0, dispatch per SPEC 12.5, return the
 * exit code. All output goes through the given writers; the working
 * directory arrives as data — the entry reads no `process` globals.
 */
export async function main(
  argv: readonly string[],
  cwd: string,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<ExitCode> {
  const result = parseArgv(argv);
  if (!result.ok) {
    // SPEC 12.0: the syntax class — every error the invocation's arguments
    // alone determine: unknown commands, subcommands, or flags, repeated
    // flags, missing required flags or arguments, surplus operands,
    // malformed values, and every invalid flag value or operand spelling a
    // fixed vocabulary, a spelling rule, or a co-occurrence rule decides —
    // is reported here, before the configuration is located, so no
    // configuration state changes it: exit 2 with the diagnostic on
    // standard error. With JSON output in effect (a `--json` token read as
    // a flag, even when the arguments are themselves the error, or a
    // JSON-only surface), the 12.7 error document — one code-less,
    // path-less finding — is the entire standard output; otherwise
    // standard output stays empty.
    stderr.write(`xspec: ${result.message}\n`);
    if (result.jsonInEffect) {
      emitErrorDocument(stdout, usageErrorFinding(result.message));
    }
    return 2;
  }

  // SPEC 12.6: `version` is workspace-independent — it consults no
  // workspace and no configuration (`--config` accepted, not consulted;
  // SPEC 7: every command *except* `version` locates the configuration), so
  // it dispatches before workspace location and cannot fail for workspace
  // or configuration reasons: configuration-error precedence (SPEC 14.14)
  // never reaches it.
  if (result.invocation.command === "version") {
    const { versionCommand } = await import("./commands/version.js");
    return versionCommand(stdout);
  }

  const loadHandler = HANDLERS.get(result.invocation.command);
  if (loadHandler === undefined) {
    // Unreachable: the dispatch table is built from the same command table
    // the parser matches against. Guarded so a table regression fails loudly.
    throw new Error(
      `no handler registered for command '${result.invocation.command}'`,
    );
  }
  try {
    return await dispatchInWorkspace(
      result.invocation,
      loadHandler,
      cwd,
      stdout,
      stderr,
    );
  } catch (error) {
    // SPEC 14.24–14.26/12.0: a write or a read the environment refuses
    // stops the command at that write or read — thrown there by the
    // workspace layer, so nothing later was attempted and every earlier
    // write stands complete (13.5) — and a mutating command refused at
    // acquisition, its workspace busy, stops there, modifying nothing
    // (13.5). Each is a usage error, not a finding: exit 2, the diagnostic
    // on standard error and, with JSON output in effect, the 12.7 error
    // document carrying the stable code (`write-failure`, `read-failure`,
    // `workspace-busy`) and the concerned path as the entire standard
    // output. Every writing command answers only after its writes, and a
    // mutating command acquires before it answers anything, so nothing of
    // an answer precedes the document.
    if (error instanceof CodedRefusal) {
      emitCodedRefusal(
        { stdout, stderr },
        jsonOutputInEffect(result.invocation),
        error.finding,
      );
      return 2;
    }
    throw error;
  }
}

/**
 * The workspace-bound part of an invocation: locate and load the
 * configuration, then dispatch to the command's handler.
 */
async function dispatchInWorkspace(
  invocation: Invocation,
  loadHandler: () => Promise<CommandHandler>,
  cwd: string,
  stdout: CliWriter,
  stderr: CliWriter,
): Promise<ExitCode> {
  // SPEC 7/14.14: every command locates and loads the configuration —
  // upward search from the working directory, or the `--config <path>`
  // value resolved against it (12.0). A missing or invalid configuration
  // is a configuration error, reported as a usage error (exit 2) preceding
  // all source analysis — with JSON output in effect, the 12.7 error
  // document as the entire standard output (12.0).
  const location = await locateWorkspace(cwd, invocation.config);
  if (!location.ok) {
    emitConfigurationErrors(
      { stdout, stderr },
      jsonOutputInEffect(invocation),
      location.concernedPath,
      location.findings,
    );
    return 2;
  }

  // SPEC 7/14.14: parse and validate the configuration — an invalid one is
  // a configuration error (exit 2) preceding all source analysis — then
  // dispatch.
  const { parseLocatedWorkspace } = await import("../workspace/config.js");
  const loaded = parseLocatedWorkspace(location.located);
  if (!loaded.ok) {
    emitConfigurationErrors(
      { stdout, stderr },
      jsonOutputInEffect(invocation),
      location.located.configAnchor,
      loaded.findings,
    );
    return 2;
  }
  const handler = await loadHandler();
  return handler(invocation, {
    cwd,
    workspace: loaded.workspace,
    stdout,
    stderr,
  });
}
