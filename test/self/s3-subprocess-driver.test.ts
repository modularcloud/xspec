// S-3 Subprocess driver self-test (TEST-SPEC 17). The blackbox driver is the
// only channel through which any test reaches a product (H-2, C-2), so its
// mechanics are pinned against a known-behavior stand-in command before any
// product-facing test or certification trusts them: exact exit codes,
// byte-verbatim stdout/stderr separation (H-5), enforced per-test working
// directories, controlled environment, argv fidelity without shell
// interpretation, timeout-as-failure for hangs (reported as failures, never
// skips — H-8), diagnosed failures for missing executables, and the 13.5
// machinery: background start, hold-file choreography, kill, concurrency.
// The capture limit (H-11) is pinned here too: an overflow is a loud
// `ProductRunOutputOverflowError`, never a truncation, which the hold-file
// wait surfaces as itself and `rethrowHarnessError` — the first call of
// every helper converting a run's rejection — lets through unchanged. So is
// the classification of the driver's in-run evaluation (H-11): T6.5-22(a)'s
// check of a performed move (helpers/added-import-identifiers.ts), made to
// fail on purpose through a scoped `vi.doMock` of that module — the driver
// loads it on demand, so the mock reaches the driver's own import — is a
// harness error, `HarnessEvaluationError` carrying the original as its
// `cause`, whether it fails before the spawn or judging the exited run,
// while its breach (`HarnessAssertionError`) passes through unchanged. A
// crash inside the check's own MDX parse — injected into `readMdxTree`
// reading a spec source the move rewrote, on either side of the move — is
// that harness error too, never taken for the diagnosed "not well-formed"
// breach a rewrite that genuinely does not derive stays; and
// `judgeAddedImportsOfFile`, which T6.5-22(b) and T6.5-23 call directly,
// throws such a crash instead of returning it as a problem. The driver's
// second in-run evaluation, T12.7-1's marker walk over the captured stdout
// of every invocation with JSON output in effect (helpers/capture-walk.ts),
// is pinned against an emitting stand-in: a near-marker rejects the run,
// diagnosed, by flag and by JSON-only surface, on every exit code, a run
// killed by request included; a run without JSON output in effect, or
// whose stdout is no one JSON document, passes untouched; and a crash of
// the walk, armed through a pass-through mock of its module, is the
// harness error `HarnessEvaluationError` (stage `walk`).
//
// The stand-in is a tiny argv-driven Node script written into a fresh
// TestWorkspace per test (the builder itself is certified by S-2) and driven
// through the same ProductBinding shape product-facing tests use. Platform
// gates mirror TEST-SPEC's staging notes, not CI skips: the `self` project
// runs on Linux in CI (harness-self job), where every test here executes;
// the kill-signal shape is asserted on POSIX, where the 13.5 suite tests
// that rely on it run (the E-6 Windows subset contains no 13.5 test).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { expect, onTestFinished, test, vi } from "vitest";
import type * as AddedImportCheckModule from "../helpers/added-import-identifiers.js";
import { judgeAddedImportsOfFile } from "../helpers/added-import-identifiers.js";
import {
  HarnessAssertionError,
  parseJsonStdout,
} from "../helpers/assertions.js";
import type * as CaptureWalkModule from "../helpers/capture-walk.js";
import {
  ProcessGroupLingerError,
  VoidedTrialsExhaustedError,
} from "../helpers/kill-discipline.js";
import type * as MdxDerivabilityModule from "../helpers/mdx-derivability.js";
import {
  builtProductBinding,
  createHoldFile,
  HarnessEvaluationError,
  pathExists,
  ProductRunOutputOverflowError,
  ProductRunTimeoutError,
  releaseHoldFile,
  rethrowHarnessError,
  runProduct,
  startProduct,
} from "../helpers/subprocess.js";
import type {
  ArgvValue,
  ProductBinding,
  RunResult,
} from "../helpers/subprocess.js";
import { TestWorkspace } from "../helpers/workspace.js";

const onPosix = process.platform !== "win32";

const hex = (data: Uint8Array): string => Buffer.from(data).toString("hex");

// Known-behavior stand-in: every mode's observable behavior is fixed by this
// source, so assertions about the driver have an unambiguous ground truth.
const STANDIN_SOURCE = `import fs from "node:fs";

const [mode, ...args] = process.argv.slice(2);
switch (mode) {
  case "exit": {
    process.exit(Number(args[0]));
    break;
  }
  case "interleave": {
    for (let i = 0; i < 40; i += 1) {
      process.stdout.write("out" + i + ";");
      process.stderr.write("err" + i + ";");
    }
    process.exit(9);
    break;
  }
  case "bytes": {
    process.stdout.write(Buffer.from([0x6f, 0x75, 0x74, 0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x0d]));
    process.stderr.write(Buffer.from([0x65, 0x72, 0x72, 0x80, 0xc3, 0x28, 0x0a]));
    process.exit(0);
    break;
  }
  case "move": {
    fs.writeFileSync("moved", "");
    const writes = JSON.parse(process.env.XSPEC_S3_MOVE_WRITES ?? "{}");
    for (const [rel, content] of Object.entries(writes)) {
      fs.writeFileSync(rel, content);
    }
    process.exit(0);
    break;
  }
  case "cwd": {
    process.stdout.write(process.cwd());
    process.exit(0);
    break;
  }
  case "argv": {
    process.stdout.write(JSON.stringify(args));
    process.exit(0);
    break;
  }
  case "env": {
    for (const name of args) {
      const value = name in process.env ? process.env[name] : "<absent>";
      process.stdout.write(name + "=" + value + "\\n");
    }
    process.exit(0);
    break;
  }
  case "hang": {
    setInterval(() => {}, 60000);
    break;
  }
  case "hold": {
    fs.writeFileSync(args[0], "");
    const poll = setInterval(() => {
      if (!fs.existsSync(args[0])) {
        clearInterval(poll);
        process.stdout.write("released");
        process.exit(0);
      }
    }, 10);
    break;
  }
  case "spam": {
    const chunk = "x".repeat(1024);
    for (let i = 0; i < 1024; i += 1) process.stdout.write(chunk);
    setInterval(() => {}, 60000);
    break;
  }
  default: {
    process.stderr.write("unknown mode: " + String(mode));
    process.exit(99);
  }
}
`;

interface Standin {
  readonly workspace: TestWorkspace;
  readonly binding: ProductBinding;
}

/** A fresh workspace holding the stand-in, beside `files` when given. */
async function standin(
  files: Readonly<Record<string, string>> = {},
): Promise<Standin> {
  const workspace = await TestWorkspace.create({
    files: { "standin.mjs": STANDIN_SOURCE, ...files },
  });
  onTestFinished(() => workspace.dispose());
  return {
    workspace,
    binding: {
      label: "S-3 stand-in",
      command: process.execPath,
      prefixArgs: [workspace.path("standin.mjs")],
    },
  };
}

test("captures exact exit codes (0, 3, 86), concurrently invoked", async () => {
  const { workspace, binding } = await standin();
  const results = await Promise.all(
    [0, 3, 86].map((code) =>
      runProduct(binding, {
        cwd: workspace.root,
        argv: ["exit", String(code)],
      }),
    ),
  );
  expect(results.map((result) => result.exitCode)).toEqual([0, 3, 86]);
  for (const result of results) {
    expect(result.signal).toBeNull();
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  }
});

test("keeps stdout and stderr separated across interleaved writes (H-5)", async () => {
  const { workspace, binding } = await standin();
  const result = await runProduct(binding, {
    cwd: workspace.root,
    argv: ["interleave"],
  });
  expect(result.exitCode).toBe(9);
  const indexes = Array.from({ length: 40 }, (_, i) => i);
  expect(result.stdout).toBe(indexes.map((i) => `out${i};`).join(""));
  expect(result.stderr).toBe(indexes.map((i) => `err${i};`).join(""));
});

test("captures output streams byte-verbatim (NUL, invalid UTF-8, CR/CRLF included)", async () => {
  const { workspace, binding } = await standin();
  const result = await runProduct(binding, {
    cwd: workspace.root,
    argv: ["bytes"],
  });
  expect(result.exitCode).toBe(0);
  expect(hex(result.stdoutBytes)).toBe(
    hex(
      Uint8Array.from([0x6f, 0x75, 0x74, 0x00, 0xff, 0xfe, 0x0d, 0x0a, 0x0d]),
    ),
  );
  expect(hex(result.stderrBytes)).toBe(
    hex(Uint8Array.from([0x65, 0x72, 0x72, 0x80, 0xc3, 0x28, 0x0a])),
  );
});

test("runs the child in exactly the given per-test working directory", async () => {
  const { workspace, binding } = await standin();
  await workspace.dir("cwd-a");
  await workspace.dir("cwd-b");
  const observed: string[] = [];
  for (const rel of ["cwd-a", "cwd-b"]) {
    const dir = workspace.path(rel);
    const result = await runProduct(binding, { cwd: dir, argv: ["cwd"] });
    expect(result.exitCode).toBe(0);
    // realpath both sides: the comparison must not depend on symlinks in the
    // OS temp directory location.
    observed.push(await fsp.realpath(result.stdout));
    expect(observed.at(-1)).toBe(await fsp.realpath(dir));
  }
  expect(observed[0]).not.toBe(observed[1]);
});

test("refuses relative, missing, and non-directory working directories, diagnosed", async () => {
  const { workspace, binding } = await standin();
  await workspace.file("plain.txt", "not a directory\n");
  await expect(
    runProduct(binding, { cwd: "relative/dir", argv: ["exit", "0"] }),
  ).rejects.toThrow(/absolute/);
  await expect(
    runProduct(binding, {
      cwd: path.join(workspace.tempRoot, "missing-dir"),
      argv: ["exit", "0"],
    }),
  ).rejects.toThrow(/working directory does not exist/);
  await expect(
    runProduct(binding, {
      cwd: workspace.path("plain.txt"),
      argv: ["exit", "0"],
    }),
  ).rejects.toThrow(/not a directory/);
});

test("controls the child environment: ambient GIT_*/EMAIL/NODE_OPTIONS/FORCE_COLOR never leak; git isolation pinned; binding and invocation env merge in order", async () => {
  const ambient: Record<string, string> = {
    XSPEC_S3_AMBIENT: "yes",
    GIT_AUTHOR_NAME: "Ambient Leak",
    EMAIL: "ambient@example.invalid",
    NODE_OPTIONS: "--max-http-header-size=32768",
    FORCE_COLOR: "3",
  };
  const saved = new Map<string, string | undefined>(
    Object.keys(ambient).map((name) => [name, process.env[name]]),
  );
  try {
    Object.assign(process.env, ambient);
    const { workspace, binding } = await standin();

    const base = await runProduct(binding, {
      cwd: workspace.root,
      argv: [
        "env",
        "XSPEC_S3_AMBIENT",
        "GIT_AUTHOR_NAME",
        "EMAIL",
        "NODE_OPTIONS",
        "FORCE_COLOR",
        "GIT_CONFIG_NOSYSTEM",
        "GIT_TERMINAL_PROMPT",
        "GIT_CONFIG_GLOBAL",
      ],
    });
    expect(base.exitCode).toBe(0);
    expect(base.stdout).toBe(
      [
        "XSPEC_S3_AMBIENT=yes",
        "GIT_AUTHOR_NAME=<absent>",
        "EMAIL=<absent>",
        "NODE_OPTIONS=<absent>",
        "FORCE_COLOR=<absent>",
        "GIT_CONFIG_NOSYSTEM=1",
        "GIT_TERMINAL_PROMPT=0",
        `GIT_CONFIG_GLOBAL=${os.devNull}`,
        "",
      ].join("\n"),
    );

    const withBindingEnv: ProductBinding = {
      ...binding,
      env: {
        XSPEC_S3_BINDING: "from-binding",
        XSPEC_S3_OVERRIDE: "binding-level",
      },
    };
    const merged = await runProduct(withBindingEnv, {
      cwd: workspace.root,
      argv: [
        "env",
        "XSPEC_S3_BINDING",
        "XSPEC_S3_OVERRIDE",
        "XSPEC_S3_AMBIENT",
      ],
      env: {
        XSPEC_S3_OVERRIDE: "invocation-level",
        XSPEC_S3_AMBIENT: undefined,
      },
    });
    expect(merged.exitCode).toBe(0);
    expect(merged.stdout).toBe(
      [
        "XSPEC_S3_BINDING=from-binding",
        "XSPEC_S3_OVERRIDE=invocation-level",
        "XSPEC_S3_AMBIENT=<absent>",
        "",
      ].join("\n"),
    );
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("argv reaches the child verbatim — no shell interpretation, empty and metacharacter arguments intact", async () => {
  const { workspace, binding } = await standin();
  const payload = [
    "--test-hold",
    "a b",
    "",
    "*.mdx",
    "$HOME",
    "--",
    "-x",
    "héé",
    '"quoted"',
  ];
  const result = await runProduct(binding, {
    cwd: workspace.root,
    argv: ["argv", ...payload],
  });
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(payload);
});

test.runIf(onPosix)(
  "raw-byte (Uint8Array) argv elements reach the child byte-verbatim via the POSIX trampoline — non-UTF-8 argument staging (T6.5-5, T12.0-5)",
  async () => {
    const { workspace } = await standin();
    // `/bin/sh` itself is the known-behavior stand-in: `printf %s "$1"`
    // emits its first positional parameter's exact bytes, so the child-side
    // ground truth is unambiguous. The payload mixes invalid UTF-8 (0xFF, a
    // truncated multibyte sequence) with a trailing newline — the byte the
    // trampoline's command substitution would strip without its sentinel.
    const shBinding: ProductBinding = {
      label: "sh printf stand-in",
      command: "/bin/sh",
    };
    const payload = Buffer.from([
      0x73, 0x70, 0x65, 0x63, 0x73, 0x2f, 0xff, 0xc3, 0x2e, 0x6d, 0x64, 0x78,
      0x0a,
    ]);
    const result = await runProduct(shBinding, {
      cwd: workspace.root,
      argv: ["-c", 'printf %s "$1"', "sh", new Uint8Array(payload)],
    });
    expect(result.exitCode).toBe(0);
    expect(hex(result.stdoutBytes)).toBe(hex(payload));

    // String elements around a byte element keep their order and values.
    const mixed = await runProduct(shBinding, {
      cwd: workspace.root,
      argv: [
        "-c",
        'printf "%s|%s|%s" "$1" "$2" "$3"',
        "sh",
        "before",
        new Uint8Array([0x2d, 0x80, 0x2d]),
        "after $HOME",
      ],
    });
    expect(mixed.exitCode).toBe(0);
    expect(hex(mixed.stdoutBytes)).toBe(
      hex(
        Buffer.concat([
          Buffer.from("before|"),
          Buffer.from([0x2d, 0x80, 0x2d]),
          Buffer.from("|after $HOME"),
        ]),
      ),
    );
  },
);

test("converts a hanging child into a diagnosed timeout failure and kills it (H-8: never a skip, never a harness hang)", async () => {
  const { workspace, binding } = await standin();
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["hang"],
    timeoutMs: 250,
  });
  await expect(running.waitForExit()).rejects.toThrow(/timed out after 250 ms/);
  // The rejection settles only after the child is dead and its streams are
  // closed — nothing lingers past the failure.
  expect(running.hasExited()).toBe(true);
  await expect(
    runProduct(binding, {
      cwd: workspace.root,
      argv: ["hang"],
      timeoutMs: 250,
    }),
  ).rejects.toThrow(/timed out/);
});

test("a missing executable or required build artifact fails diagnosed, not as a harness crash (H-8)", async () => {
  const { workspace } = await standin();
  const missingCommand = path.join(workspace.tempRoot, "no-such-binary");
  const spawnError = await runProduct(
    { label: "missing executable", command: missingCommand },
    { cwd: workspace.root },
  ).then(
    () => null,
    (error: unknown) => error as Error,
  );
  expect(spawnError).not.toBeNull();
  expect(spawnError!.message).toContain("failed to start");
  expect(spawnError!.message).toContain(missingCommand);

  const missingArtifact = path.join(workspace.tempRoot, "not-built.js");
  const artifactError = await runProduct(
    {
      label: "unbuilt product",
      command: process.execPath,
      prefixArgs: [missingArtifact],
      requiredFiles: [missingArtifact],
    },
    { cwd: workspace.root },
  ).then(
    () => null,
    (error: unknown) => error as Error,
  );
  expect(artifactError).not.toBeNull();
  expect(artifactError!.message).toContain("required file missing");
  expect(artifactError!.message).toContain(missingArtifact);
  expect(artifactError!.message).toContain("npm run build");
});

test("builtProductBinding names the built executable absolutely, independent of the process cwd (C-2 default binding)", () => {
  const binding = builtProductBinding();
  expect(binding.command).toBe(process.execPath);
  expect(binding.prefixArgs).toHaveLength(1);
  const binJs = binding.prefixArgs![0]!;
  expect(path.isAbsolute(binJs)).toBe(true);
  expect(binJs.endsWith(path.join("dist", "cli", "bin.js"))).toBe(true);
  // The pre-flight check targets exactly the executable artifact, so an
  // unbuilt product fails diagnosed (H-8) rather than as a confusing spawn.
  expect(binding.requiredFiles).toEqual([binJs]);
});

test("background start with hold-file choreography: await creation, hold, release, completion (13.5 seam support)", async () => {
  const { workspace, binding } = await standin();
  const holdPath = path.join(workspace.tempRoot, "hold");
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["hold", holdPath],
  });
  await running.waitForFile(holdPath);
  expect(await pathExists(holdPath)).toBe(true);
  // Held: the child is alive and has not proceeded past the hold.
  expect(running.hasExited()).toBe(false);
  await releaseHoldFile(holdPath);
  const result = await running.waitForExit();
  expect(result.exitCode).toBe(0);
  expect(result.stdout).toBe("released");
  expect(await pathExists(holdPath)).toBe(false);
});

test("createHoldFile stages an empty file, refuses an occupied path; releaseHoldFile is idempotent", async () => {
  const { workspace } = await standin();
  const holdPath = path.join(workspace.tempRoot, "staged-hold");
  await createHoldFile(holdPath);
  expect(await pathExists(holdPath)).toBe(true);
  expect((await fsp.readFile(holdPath)).length).toBe(0);
  await expect(createHoldFile(holdPath)).rejects.toThrow(/EEXIST/);
  await releaseHoldFile(holdPath);
  expect(await pathExists(holdPath)).toBe(false);
  await releaseHoldFile(holdPath);
});

test.runIf(onPosix)(
  "kill() terminates a held child; waitForExit reports the signal death (T13.5-3 support)",
  async () => {
    const { workspace, binding } = await standin();
    const holdPath = path.join(workspace.tempRoot, "hold-to-kill");
    const running = await startProduct(binding, {
      cwd: workspace.root,
      argv: ["hold", holdPath],
    });
    await running.waitForFile(holdPath);
    running.kill();
    const result = await running.waitForExit();
    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe("SIGKILL");
    // The child never proceeded past the hold, and the abandoned hold file
    // stays on disk: a terminated holder leaves only inert state behind.
    expect(result.stdout).toBe("");
    expect(await pathExists(holdPath)).toBe(true);
  },
);

test("waitForFile fails diagnosed when the child exits without creating the file (red-green path for stub products, H-8)", async () => {
  const { workspace, binding } = await standin();
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["exit", "86"],
  });
  const neverCreated = path.join(workspace.tempRoot, "never-created");
  const error = await running.waitForFile(neverCreated).then(
    () => null,
    (thrown: unknown) => thrown as Error,
  );
  expect(error).not.toBeNull();
  expect(error!.message).toContain("exited before creating");
  expect(error!.message).toContain(neverCreated);
  expect(error!.message).toContain("exit code 86");
  // The run outcome itself stays available for further diagnosis.
  expect((await running.waitForExit()).exitCode).toBe(86);
});

test("waitForFile times out diagnosed against a live child that never creates the file", async () => {
  const { workspace, binding } = await standin();
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["hang"],
  });
  await expect(
    running.waitForFile(path.join(workspace.tempRoot, "never"), {
      timeoutMs: 200,
    }),
  ).rejects.toThrow(/timed out after 200 ms waiting for/);
  running.kill();
  await running.waitForExit();
});

test("concurrent invocations stay isolated: each returns its own argv, output, and exit code (13.5 support)", async () => {
  const { workspace, binding } = await standin();
  const argvRuns = Promise.all(
    [0, 1, 2].map((i) =>
      runProduct(binding, {
        cwd: workspace.root,
        argv: ["argv", `payload-${i}`],
      }),
    ),
  );
  const exitRuns = Promise.all(
    [11, 12, 13].map((code) =>
      runProduct(binding, {
        cwd: workspace.root,
        argv: ["exit", String(code)],
      }),
    ),
  );
  const [argvResults, exitResults] = await Promise.all([argvRuns, exitRuns]);
  argvResults.forEach((result, i) => {
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([`payload-${i}`]);
    expect(result.stderr).toBe("");
  });
  expect(exitResults.map((result) => result.exitCode)).toEqual([11, 12, 13]);
});

test("a child exceeding the output cap is killed with a loud overflow error, never a silent truncation (H-8: runaway output never hangs the harness; H-11)", async () => {
  const { workspace, binding } = await standin();
  await expect(
    runProduct(binding, {
      cwd: workspace.root,
      argv: ["spam"],
      maxOutputBytes: 2048,
    }),
  ).rejects.toThrow(/exceeded the output limit of 2048 bytes/);
});

test("waitForFile surfaces a capture-limit kill as the driver's ProductRunOutputOverflowError itself, never folded into the premature-exit error (H-11)", async () => {
  const { workspace, binding } = await standin();
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["spam"],
    maxOutputBytes: 2048,
  });
  const neverCreated = path.join(workspace.tempRoot, "never-created");
  const error = await running.waitForFile(neverCreated).then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ProductRunOutputOverflowError);
  expect((error as Error).message).toMatch(
    /exceeded the output limit of 2048 bytes/,
  );
  expect((error as Error).message).not.toContain("exited before creating");
  // The very rejection the run settled with, not a copy.
  const settled = await running.waitForExit().then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(settled).toBe(error);
});

test("rethrowHarnessError rethrows exactly the harness errors — the capture-limit error, a failed in-run evaluation, a group kill that could not confirm its group gone, and an exhausted voidable trial — unchanged, and returns for every other rejection a helper converts (H-11)", () => {
  for (const harnessError of [
    new ProductRunOutputOverflowError("capture limit"),
    new ProcessGroupLingerError("stand-in", 4242, "listed", 30_000, [], [4243]),
    new VoidedTrialsExhaustedError("stand-in trial", ["reused identifier"]),
    new HarnessEvaluationError(
      "stand-in move",
      "verify",
      new Error("evaluation crashed"),
    ),
    new HarnessEvaluationError(
      "stand-in move",
      "prepare",
      new RangeError("parser limit"),
    ),
  ]) {
    let rethrown: unknown = null;
    try {
      rethrowHarnessError(harnessError);
    } catch (thrown) {
      rethrown = thrown;
    }
    expect(rethrown, harnessError.message).toBe(harnessError);
  }
  for (const other of [
    new ProductRunTimeoutError("hang guard"),
    new HarnessAssertionError("diagnosed"),
    new Error("failed to start"),
    "not an error",
    undefined,
  ]) {
    expect(() => {
      rethrowHarnessError(other);
    }).not.toThrow();
  }
});

// ---------------------------------------------------------------------------
// The driver's in-run evaluation (H-11): T6.5-22(a)'s check of a performed
// move (helpers/added-import-identifiers.ts) is the harness evaluating the
// run's answer, so its own failure is a harness error, never a diagnosed
// product failure — and its breach stays the diagnosed failure it is.

/** The module the driver loads on demand for T6.5-22(a)'s check. */
const CHECK_MODULE = "../helpers/added-import-identifiers.js";

/** A performed move's argv, as the driver reads it (the stand-in's `move`). */
const MOVE_ARGV = ["move", "specs/A.mdx", "specs/B.mdx"];

/**
 * Replace T6.5-22(a)'s check for the running test alone: a scoped
 * `vi.doMock` of the module the driver imports on demand, the real module's
 * other exports kept; undone when the test finishes.
 */
function injectAddedImportCheck(
  prepare: typeof AddedImportCheckModule.prepareAddedImportCheck,
): void {
  vi.doMock(CHECK_MODULE, async (importOriginal) => ({
    ...(await importOriginal<typeof AddedImportCheckModule>()),
    prepareAddedImportCheck: prepare,
  }));
  onTestFinished(() => {
    vi.doUnmock(CHECK_MODULE);
  });
}

/** What a promise rejects with; null when it resolves. */
async function rejectionOf(pending: Promise<unknown>): Promise<unknown> {
  return await pending.then(
    () => null,
    (thrown: unknown) => thrown,
  );
}

test("a failure of T6.5-22(a)'s check judging an exited move rejects waitForExit and runProduct with the harness error HarnessEvaluationError, its cause the original — never a diagnosed HarnessAssertionError (H-11)", async () => {
  const { workspace, binding } = await standin();
  const original = new Error("S-3: the check's judgement crashed");
  const judged: (number | null)[] = [];
  injectAddedImportCheck(async () => ({
    verify: async (result) => {
      judged.push(result.exitCode);
      throw original;
    },
  }));
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: MOVE_ARGV,
  });
  const settled = await rejectionOf(running.waitForExit());
  expect(settled).toBeInstanceOf(HarnessEvaluationError);
  expect(settled).not.toBeInstanceOf(HarnessAssertionError);
  const error = settled as HarnessEvaluationError;
  expect(error.cause).toBe(original);
  expect(error.stage).toBe("verify");
  expect(error.commandLine).toBe(running.commandLine);
  expect(error.message).toContain("T6.5-22(a)");
  expect(error.message).toContain(running.commandLine);
  expect(error.message).toContain(original.message);
  // The judgement ran on the exited run; every await sees the same error.
  expect(judged).toEqual([0]);
  expect(await rejectionOf(running.waitForExit())).toBe(error);
  // The foreground path rejects alike.
  const foreground = await rejectionOf(
    runProduct(binding, { cwd: workspace.root, argv: MOVE_ARGV }),
  );
  expect(foreground).toBeInstanceOf(HarnessEvaluationError);
  expect((foreground as HarnessEvaluationError).cause).toBe(original);
});

test("a failure of T6.5-22(a)'s check reading the pre-operation sources rejects startProduct with HarnessEvaluationError, nothing spawned (H-11)", async () => {
  const { workspace, binding } = await standin();
  const original = new RangeError("S-3: the pre-operation reading crashed");
  injectAddedImportCheck(async () => {
    throw original;
  });
  const rejected = await rejectionOf(
    startProduct(binding, { cwd: workspace.root, argv: MOVE_ARGV }),
  );
  expect(rejected).toBeInstanceOf(HarnessEvaluationError);
  expect(rejected).not.toBeInstanceOf(HarnessAssertionError);
  const error = rejected as HarnessEvaluationError;
  expect(error.cause).toBe(original);
  expect(error.stage).toBe("prepare");
  expect(error.message).toContain("T6.5-22(a)");
  expect(error.message).toContain(MOVE_ARGV.join(" "));
  // The reading precedes the spawn: the stand-in's `move` never ran.
  expect(await pathExists(workspace.path("moved"))).toBe(false);
});

test("a T6.5-22(a) breach (HarnessAssertionError) passes through the driver unchanged — the very error, from waitForExit and from startProduct — a diagnosed product failure", async () => {
  const { workspace, binding } = await standin();
  const breach = new HarnessAssertionError("T6.5-22(a): stand-in breach");
  injectAddedImportCheck(async () => ({
    verify: async () => {
      throw breach;
    },
  }));
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: MOVE_ARGV,
  });
  expect(await rejectionOf(running.waitForExit())).toBe(breach);
  const early = new HarnessAssertionError("T6.5-22(a): stand-in early");
  injectAddedImportCheck(async () => {
    throw early;
  });
  expect(
    await rejectionOf(
      startProduct(binding, { cwd: workspace.root, argv: MOVE_ARGV }),
    ),
  ).toBe(early);
});

test("waitForFile on a run whose T6.5-22(a) check fails rejects with that HarnessEvaluationError itself, never folded into the premature-exit error (H-11)", async () => {
  const { workspace, binding } = await standin();
  const original = new Error("S-3: the check's judgement crashed");
  injectAddedImportCheck(async () => ({
    verify: async () => {
      throw original;
    },
  }));
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: MOVE_ARGV,
  });
  const neverCreated = path.join(workspace.tempRoot, "never-created");
  const error = await rejectionOf(running.waitForFile(neverCreated));
  expect(error).toBeInstanceOf(HarnessEvaluationError);
  expect((error as Error).cause).toBe(original);
  expect((error as Error).message).not.toContain("exited before creating");
  // The very rejection the run settled with, not a copy.
  expect(await rejectionOf(running.waitForExit())).toBe(error);
});

// ---------------------------------------------------------------------------
// A crash of the harness's own MDX parse inside T6.5-22(a)'s check (H-11):
// reading a spec source a performed move rewrote, the check takes the
// parse's grammar verdict alone (`MdxNonDerivationError`) for "not
// well-formed", the diagnosed breach, and lets anything else the read
// throws — an exhausted stack, say — propagate as the harness's own
// failure. The fault is injected into `readMdxTree`
// (helpers/mdx-derivability.ts), which the check module binds when it is
// first loaded: a `vi.doMock` made after any test of this file loaded that
// module would not reach it, so the module is mocked for the whole file
// (Vitest hoists `vi.mock` above the imports) by a pass-through that throws
// only while the running test arms it, disarmed when that test finishes.

/** The armed fault: what `readMdxTree` throws reading a text, if anything. */
const mdxReadFault = vi.hoisted(() => ({
  throwFor: undefined as ((text: string) => Error | undefined) | undefined,
}));

vi.mock("../helpers/mdx-derivability.js", async (importOriginal) => {
  const actual = await importOriginal<typeof MdxDerivabilityModule>();
  const readMdxTree: typeof actual.readMdxTree = (text) => {
    const fault = mdxReadFault.throwFor?.(text);
    if (fault !== undefined) throw fault;
    return actual.readMdxTree(text);
  };
  return { ...actual, readMdxTree };
});

/** Arms the fault for the running test alone: `readMdxTree` throws `error`
 * reading exactly `text`, and reads every other text as it does. */
function injectMdxReadFault(text: string, error: Error): void {
  mdxReadFault.throwFor = (read) => (read === text ? error : undefined);
  onTestFinished(() => {
    mdxReadFault.throwFor = undefined;
  });
}

/** The stand-in's `move` writes these files (relative path to content). */
const MOVE_WRITES_ENV = "XSPEC_S3_MOVE_WRITES";

/** A performed section-form move, as the driver reads it (SPEC 6.5, 12.0). */
const SECTION_MOVE_ARGV = ["move", "specs/A.mdx#a", "specs/B.mdx#b.a"];

const SECTION_B = '<S id="b">\n\nBeta.\n</S>\n';

/** `specs/B.mdx` once `a` moved into it: well-formed, no import added. */
const REWRITTEN_B = '<S id="b">\n\nBeta.\n\n<S id="a">\n\nAlpha.\n</S>\n</S>\n';

/** A rewrite that genuinely does not derive under 14.20 (`<S>` unclosed). */
const UNCLOSED_B = '<S id="b">\n\nBeta.\n';

/** The workspace's one spec group discovers both sources (SPEC 7). */
const SPEC_WORKSPACE = {
  "xspec.config.ts": `import { defineConfig } from "xspec"

export default defineConfig({
  specs: {
    main: ["specs/**/*.mdx"]
  }
})
`,
  "specs/A.mdx": '<S id="a">\n\nAlpha.\n</S>\n',
  "specs/B.mdx": SECTION_B,
};

/** The stand-in's environment for a move rewriting `specs/B.mdx` so. */
const rewritingB = (content: string): Readonly<Record<string, string>> => ({
  [MOVE_WRITES_ENV]: JSON.stringify({ "specs/B.mdx": content }),
});

/** What a call throws; null when it returns. */
function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (thrown) {
    return thrown;
  }
  return null;
}

const NOT_WELL_FORMED_AFTER =
  /specs\/B\.mdx, which the operation rewrote, is not well-formed under its grammar after it \(SPEC 14\.20: /;

test("a crash of the harness's own MDX parse reading a spec source a performed move rewrote, on either side of the move, rejects runProduct and waitForExit with HarnessEvaluationError, its cause the original — never the diagnosed 'not well-formed' HarnessAssertionError (H-11)", async () => {
  const { workspace, binding } = await standin(SPEC_WORKSPACE);
  // The rewritten text, read once the run exited: the foreground path.
  const afterCrash = new RangeError("Maximum call stack size exceeded");
  injectMdxReadFault(REWRITTEN_B, afterCrash);
  const foreground = await rejectionOf(
    runProduct(binding, {
      cwd: workspace.root,
      argv: SECTION_MOVE_ARGV,
      env: rewritingB(REWRITTEN_B),
    }),
  );
  expect(foreground).toBeInstanceOf(HarnessEvaluationError);
  expect(foreground).not.toBeInstanceOf(HarnessAssertionError);
  expect((foreground as HarnessEvaluationError).cause).toBe(afterCrash);
  expect((foreground as HarnessEvaluationError).stage).toBe("verify");
  // The run exited 0 having rewritten B: the judgement, not the run, failed.
  expect(await fsp.readFile(workspace.path("specs/B.mdx"), "utf8")).toBe(
    REWRITTEN_B,
  );

  // The pre-operation text, read once the run exited: the background path.
  await fsp.writeFile(workspace.path("specs/B.mdx"), SECTION_B);
  const beforeCrash = new RangeError("Maximum call stack size exceeded");
  injectMdxReadFault(SECTION_B, beforeCrash);
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: SECTION_MOVE_ARGV,
    env: rewritingB(REWRITTEN_B),
  });
  const settled = await rejectionOf(running.waitForExit());
  expect(settled).toBeInstanceOf(HarnessEvaluationError);
  expect(settled).not.toBeInstanceOf(HarnessAssertionError);
  expect((settled as HarnessEvaluationError).cause).toBe(beforeCrash);
  expect((settled as HarnessEvaluationError).stage).toBe("verify");
});

test("a spec source a performed move rewrote that genuinely does not derive under 14.20 (an unclosed `<S>`) stays the diagnosed breach, through the same pass-through parse (H-11's control)", async () => {
  const { workspace, binding } = await standin(SPEC_WORKSPACE);
  const error = await rejectionOf(
    runProduct(binding, {
      cwd: workspace.root,
      argv: SECTION_MOVE_ARGV,
      env: rewritingB(UNCLOSED_B),
    }),
  );
  expect(error).toBeInstanceOf(HarnessAssertionError);
  expect(error).not.toBeInstanceOf(HarnessEvaluationError);
  expect((error as Error).message).toMatch(/^T6\.5-22\(a\)/);
  expect((error as Error).message).toMatch(NOT_WELL_FORMED_AFTER);
});

test("judgeAddedImportsOfFile, called directly (T6.5-22(b), T6.5-23), throws a crash of the harness's own MDX parse on either side instead of returning it as a problem, while a genuine non-derivation stays its one problem (H-11)", () => {
  // Unfaulted, both texts read: nothing added, no problem.
  expect(
    judgeAddedImportsOfFile(
      "specs/B.mdx",
      "spec-source",
      SECTION_B,
      REWRITTEN_B,
    ),
  ).toEqual({ added: [], problems: [] });
  const crash = new RangeError("Maximum call stack size exceeded");
  injectMdxReadFault(REWRITTEN_B, crash);
  expect(
    thrownBy(() =>
      judgeAddedImportsOfFile(
        "specs/B.mdx",
        "spec-source",
        SECTION_B,
        REWRITTEN_B,
      ),
    ),
  ).toBe(crash);
  expect(
    thrownBy(() =>
      judgeAddedImportsOfFile(
        "specs/B.mdx",
        "spec-source",
        REWRITTEN_B,
        SECTION_B,
      ),
    ),
  ).toBe(crash);
  const judgement = judgeAddedImportsOfFile(
    "specs/B.mdx",
    "spec-source",
    SECTION_B,
    UNCLOSED_B,
  );
  expect(judgement.added).toEqual([]);
  expect(judgement.problems).toHaveLength(1);
  expect(judgement.problems[0]).toMatch(NOT_WELL_FORMED_AFTER);
});

// ---------------------------------------------------------------------------
// T12.7-1's walk over every captured JSON document (helpers/capture-walk.ts):
// the driver walks the captured stdout of every invocation with JSON output
// in effect — its argv read by SPEC 12.0's grammar (helpers/invocation-
// grammar.ts) — once the run has exited, so a near-marker in a document a
// test only byte-compares or never reads still fails, diagnosed; a run
// without JSON output in effect, or whose stdout is not one JSON document,
// passes untouched; and a failure of the walk itself is the harness error
// `HarnessEvaluationError` (stage `walk`, H-11). The walk's crash is armed
// through a pass-through mock of the walk's module, hoisted for the whole
// file like `readMdxTree`'s above: the driver binds the module statically.

/**
 * The walk vectors' stand-in. Its argv is never read — the argv the driver
 * reads is free to spell any invocation — and its behavior rides its
 * environment: it writes `XSPEC_S3_STDOUT` (UTF-8 text), or the bytes
 * `XSPEC_S3_STDOUT_HEX` spells in hexadecimal, to stdout and exits with
 * `XSPEC_S3_EXIT` (default 0); with `XSPEC_S3_HOLD` set it then creates
 * that file and never exits, for a kill by request.
 */
const EMIT_STANDIN_SOURCE = `import fs from "node:fs";

const hex = process.env.XSPEC_S3_STDOUT_HEX;
const bytes =
  hex === undefined
    ? Buffer.from(process.env.XSPEC_S3_STDOUT ?? "", "utf8")
    : Buffer.from(hex, "hex");
const hold = process.env.XSPEC_S3_HOLD;
process.stdout.write(bytes, () => {
  if (hold === undefined) {
    process.exitCode = Number(process.env.XSPEC_S3_EXIT ?? "0");
    return;
  }
  fs.writeFileSync(hold, "");
  setInterval(() => {}, 60000);
});
`;

/** A fresh workspace holding the walk vectors' stand-in. */
async function emitStandin(): Promise<Standin> {
  const workspace = await TestWorkspace.create({
    files: { "emit.mjs": EMIT_STANDIN_SOURCE },
  });
  onTestFinished(() => workspace.dispose());
  return {
    workspace,
    binding: {
      label: "S-3 emitting stand-in",
      command: process.execPath,
      prefixArgs: [workspace.path("emit.mjs")],
    },
  };
}

/** The stand-in's environment: emit `stdout`, then exit with `exit`. */
const emitting = (
  stdout: string,
  exit = 0,
): Readonly<Record<string, string>> => ({
  XSPEC_S3_STDOUT: stdout,
  XSPEC_S3_EXIT: String(exit),
});

/** A document carrying a near-marker at `$.nodes[0].tags` (SPEC 12.7). */
const NEAR_MARKER_DOCUMENT = `${JSON.stringify(
  {
    findings: [],
    nodes: [{ identity: "specs/A.mdx", tags: { unavailable: false } }],
  },
  null,
  2,
)}\n`;

/** The same document with the exact marker in that place. */
const EXACT_MARKER_DOCUMENT = `${JSON.stringify(
  {
    findings: [],
    nodes: [{ identity: "specs/A.mdx", tags: { unavailable: true } }],
  },
  null,
  2,
)}\n`;

/** The walk's diagnosis of the near-marker at `path` in a run's stdout. */
function expectWalkDiagnosis(
  error: unknown,
  path: string,
  argvShown: string,
): void {
  expect(error, argvShown).toBeInstanceOf(HarnessAssertionError);
  expect(error, argvShown).not.toBeInstanceOf(HarnessEvaluationError);
  const message = (error as Error).message;
  expect(message, argvShown).toContain(
    "T12.7-1, the driver's walk over every captured JSON document — stdout of",
  );
  expect(message, argvShown).toContain(argvShown);
  expect(message, argvShown).toContain(
    `at ${path}: expected no object of any form other than the unavailability marker`,
  );
}

test("the driver walks the captured stdout of every invocation with JSON output in effect — by flag or by JSON-only surface, every exit code, a run killed by request included — and rejects runProduct and waitForExit with the walk's diagnosed failure on a near-marker, naming its JSON path and the command line (T12.7-1)", async () => {
  const { workspace, binding } = await emitStandin();
  // By flag and by surface (SPEC 12.0's grammar: flags stand anywhere, a
  // value-taking flag takes the next token), on exits 0, 1, and 2.
  const cases: readonly {
    readonly argv: readonly string[];
    readonly exit: number;
  }[] = [
    { argv: ["check", "--json"], exit: 1 },
    { argv: ["--json", "build"], exit: 0 },
    { argv: ["check", "--json", "--json"], exit: 2 },
    { argv: ["query", "nodes"], exit: 0 },
    { argv: ["--config", "xspec.config.ts", "view", "specs/A.mdx"], exit: 0 },
    { argv: ["occurrences", "--to", "specs/A.mdx#a"], exit: 1 },
    { argv: ["at", "specs/A.mdx", "0"], exit: 0 },
    { argv: ["inventory"], exit: 0 },
    { argv: ["version"], exit: 0 },
    { argv: ["review", "export", "r1"], exit: 0 },
  ];
  for (const { argv, exit } of cases) {
    const error = await rejectionOf(
      runProduct(binding, {
        cwd: workspace.root,
        argv,
        env: emitting(NEAR_MARKER_DOCUMENT, exit),
      }),
    );
    expectWalkDiagnosis(error, "$.nodes[0].tags", argv.join(" "));
  }
  // An exit-2 error document and a marker with a sibling member.
  const errorDocument = await rejectionOf(
    runProduct(binding, {
      cwd: workspace.root,
      argv: ["nosuch", "--json"],
      env: emitting(
        `${JSON.stringify({
          error: {
            code: null,
            message: "unknown command",
            locations: [],
            path: { unavailable: true, bytes: "ff" },
            identities: [],
          },
        })}\n`,
        2,
      ),
    }),
  );
  expectWalkDiagnosis(errorDocument, "$.error.path", "nosuch --json");
  // The background path: every waitForExit settles with the one rejection.
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["query", "nodes", "--tag", "x"],
    env: emitting(NEAR_MARKER_DOCUMENT),
  });
  const settled = await rejectionOf(running.waitForExit());
  expectWalkDiagnosis(settled, "$.nodes[0].tags", "query nodes --tag x");
  expect(await rejectionOf(running.waitForExit())).toBe(settled);
  // A run killed by request after writing a whole document: what it
  // captured is still a JSON document, walked like any other.
  const hold = workspace.path("held");
  const killed = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["review", "export", "r1"],
    env: { ...emitting(NEAR_MARKER_DOCUMENT), XSPEC_S3_HOLD: hold },
  });
  await killed.waitForFile(hold);
  killed.kill();
  expectWalkDiagnosis(
    await rejectionOf(killed.waitForExit()),
    "$.nodes[0].tags",
    "review export r1",
  );
  // A byte argv element (POSIX staging) reads as the string its bytes
  // spell when they are valid UTF-8, as the product reads it.
  if (onPosix) {
    const byteFlag = await rejectionOf(
      runProduct(binding, {
        cwd: workspace.root,
        argv: ["check", new Uint8Array(Buffer.from("--json", "utf8"))],
        env: emitting(NEAR_MARKER_DOCUMENT, 1),
      }),
    );
    expect(byteFlag).toBeInstanceOf(HarnessAssertionError);
    expect((byteFlag as Error).message).toContain(
      "at $.nodes[0].tags: expected no object of any form other than the unavailability marker",
    );
  }
});

test("the driver leaves untouched a run without JSON output in effect, and a captured stdout that is no one JSON document or carries only exact markers (T12.7-1)", async () => {
  const { workspace, binding } = await emitStandin();
  const resolves = async (
    argv: readonly ArgvValue[],
    env: Readonly<Record<string, string>>,
  ): Promise<RunResult> => {
    const result = await runProduct(binding, {
      cwd: workspace.root,
      argv,
      env,
    });
    expect(result.signal).toBeNull();
    return result;
  };
  // JSON output not in effect (SPEC 12.0): no `--json` read as a flag — a
  // value-taking flag's value, a token after `--` — and no JSON-only
  // surface: the near-marker document is never walked, its bytes intact.
  for (const argv of [
    ["check"],
    ["check", "--note", "--json"],
    ["check", "--", "--json"],
    ["review", "list"],
    ["rename", "specs/A.mdx", "a", "b", "--preview"],
    [],
  ]) {
    const result = await resolves(argv, emitting(NEAR_MARKER_DOCUMENT, 1));
    expect(result.exitCode, argv.join(" ")).toBe(1);
    expect(result.stdout, argv.join(" ")).toBe(NEAR_MARKER_DOCUMENT);
  }
  if (onPosix) {
    // A byte argv element that is not valid UTF-8 names no command.
    const result = await resolves(
      [new Uint8Array([0xff]), "nodes"],
      emitting(NEAR_MARKER_DOCUMENT),
    );
    expect(result.stdout).toBe(NEAR_MARKER_DOCUMENT);
  }
  // JSON output in effect, every object with an `unavailable` member the
  // exact marker: the run resolves, its document as emitted.
  for (const argv of [
    ["query", "nodes"],
    ["build", "--json"],
  ]) {
    const result = await resolves(argv, emitting(EXACT_MARKER_DOCUMENT));
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(EXACT_MARKER_DOCUMENT);
  }
  // JSON output in effect, but no one JSON document to walk — empty,
  // not JSON, two documents, invalid UTF-8, a document led by a UTF-8
  // byte-order mark: the run resolves, its form left to the run's own
  // assertions (H-5).
  for (const stdout of [
    "",
    "not json\n",
    '{"unavailable": false}{"unavailable": false}\n',
  ]) {
    const result = await resolves(["check", "--json"], emitting(stdout, 1));
    expect(result.stdout).toBe(stdout);
  }
  const invalidBytes = Buffer.concat([
    Buffer.from('{"unavailable": 0}', "utf8"),
    Buffer.from([0xff]),
  ]);
  const invalid = await resolves(["view"], {
    XSPEC_S3_STDOUT_HEX: invalidBytes.toString("hex"),
  });
  expect(hex(invalid.stdoutBytes)).toBe(hex(invalidBytes));
  // The byte-order mark — U+FEFF, the bytes EF BB BF — is no part of a JSON
  // text (SPEC 12.0: the single JSON document is the entire standard
  // output), so the near-marker document it leads is never walked, though
  // the document after it would draw the walk's diagnosis; and
  // `parseJsonStdout` reads the same stdout as no one JSON document, a
  // diagnosed failure naming the mark, so the driver's reading and the
  // parse's stay one.
  const bomLedBytes = Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(NEAR_MARKER_DOCUMENT, "utf8"),
  ]);
  const bomLed = await resolves(["ids", "--json"], {
    XSPEC_S3_STDOUT_HEX: bomLedBytes.toString("hex"),
  });
  expect(bomLed.exitCode).toBe(0);
  expect(hex(bomLed.stdoutBytes)).toBe(hex(bomLedBytes));
  expect(() => parseJsonStdout(bomLed)).toThrow(HarnessAssertionError);
  expect(() => parseJsonStdout(bomLed)).toThrow(
    "begins with a UTF-8 byte-order mark (U+FEFF, the bytes EF BB BF)",
  );
});

/** The armed fault: what the walk throws for a run, if anything. */
const walkFault = vi.hoisted(() => ({
  throwFor: undefined as ((result: RunResult) => Error | undefined) | undefined,
}));

vi.mock("../helpers/capture-walk.js", async (importOriginal) => {
  const actual = await importOriginal<typeof CaptureWalkModule>();
  const walkCapturedJsonDocument: typeof actual.walkCapturedJsonDocument = (
    result,
  ) => {
    const fault = walkFault.throwFor?.(result);
    if (fault !== undefined) throw fault;
    actual.walkCapturedJsonDocument(result);
  };
  return { ...actual, walkCapturedJsonDocument };
});

test("a failure of the driver's walk itself rejects runProduct and waitForExit with the harness error HarnessEvaluationError (stage walk), its cause the original — never a diagnosed failure, never a pass (H-11)", async () => {
  const { workspace, binding } = await emitStandin();
  const crash = new RangeError("S-3: the walk crashed");
  const walked: string[] = [];
  walkFault.throwFor = (result) => {
    walked.push(result.commandLine);
    return crash;
  };
  onTestFinished(() => {
    walkFault.throwFor = undefined;
  });
  const foreground = await rejectionOf(
    runProduct(binding, {
      cwd: workspace.root,
      argv: ["query", "nodes"],
      env: emitting(EXACT_MARKER_DOCUMENT),
    }),
  );
  expect(foreground).toBeInstanceOf(HarnessEvaluationError);
  expect(foreground).not.toBeInstanceOf(HarnessAssertionError);
  const error = foreground as HarnessEvaluationError;
  expect(error.cause).toBe(crash);
  expect(error.stage).toBe("walk");
  expect(error.commandLine).toContain("query nodes");
  expect(error.message).toMatch(
    /^harness error \(H-11\): T12\.7-1's marker walk/,
  );
  expect(thrownBy(() => rethrowHarnessError(error))).toBe(error);
  const running = await startProduct(binding, {
    cwd: workspace.root,
    argv: ["check", "--json"],
    env: emitting(EXACT_MARKER_DOCUMENT, 1),
  });
  const settled = await rejectionOf(running.waitForExit());
  expect(settled).toBeInstanceOf(HarnessEvaluationError);
  expect((settled as HarnessEvaluationError).cause).toBe(crash);
  // A run without JSON output in effect never reaches the walk.
  const plain = await runProduct(binding, {
    cwd: workspace.root,
    argv: ["check"],
    env: emitting(EXACT_MARKER_DOCUMENT, 1),
  });
  expect(plain.exitCode).toBe(1);
  expect(walked).toHaveLength(2);
});
