// TEMPORARY CI probe (Phase 9 FIX_PLAN Task 48), removed by the commit after
// the CI run that reads it — never part of the harness. Only the Windows CI
// leg runs E-6's exclusion probe on Windows, and against the built product,
// which keeps its lock in the temporary folder, the probe stops at its
// first lock assertion. So this file runs the representative fixture
// (helpers/e6.ts) against a stand-in modelling SPEC 13.5's lock directory
// around the built product (zz-e6-standin.mjs) to show the probe's Windows
// half live end to end: the conforming model passes; a model reading every
// entry alive fails diagnosed at the reuse check (Windows' process list
// read, no killed identifier listed); one writing no entry fails diagnosed
// after the kill; one keeping its entry after the file-form `move` fails
// diagnosed there; and a forced void (the reuse check's first call voiding,
// the model refusing the first takeover) restores the workspace from its
// copy taken before the kill and reruns to a pass.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, vi } from "vitest";
import { runE6RepresentativeFixture } from "../helpers/e6.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const state = vi.hoisted(() => ({ voidNext: false, calls: 0 }));

vi.mock("../helpers/e6-exclusion.js", async (importOriginal) => {
  const mod =
    await importOriginal<typeof import("../helpers/e6-exclusion.js")>();
  const { voidTrial } = await import("../helpers/kill-discipline.js");
  return {
    ...mod,
    e6ReuseCheck: async (
      killed: Parameters<typeof mod.e6ReuseCheck>[0],
      refusal: string,
    ): Promise<never> => {
      state.calls += 1;
      if (state.voidNext) {
        state.voidNext = false;
        voidTrial(`temporary probe: forced void — ${refusal}`);
      }
      return await mod.e6ReuseCheck(killed, refusal);
    },
  };
});

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STANDIN = path.join(HERE, "zz-e6-standin.mjs");
const BIN_JS = path.join(HERE, "..", "..", "dist", "cli", "bin.js");
const STATE_FILE = path.join(
  os.tmpdir(),
  `zz-e6-alivefirst-${String(process.pid)}`,
);
const BUDGET_MS = 300_000;

function binding(mode: string): ProductBinding {
  return {
    label: `E-6 stand-in (${mode})`,
    command: process.execPath,
    prefixArgs: [STANDIN, mode, BIN_JS],
    requiredFiles: [BIN_JS],
    env: { E6_STANDIN_STATE: STATE_FILE },
  };
}

async function failure(mode: string): Promise<Error> {
  try {
    await runE6RepresentativeFixture(binding(mode));
  } catch (error) {
    const e = error as Error;
    console.log(`[zz-e6] ${mode}: ${e.name}: ${e.message}`);
    return e;
  }
  throw new Error(`[zz-e6] ${mode}: the fixture passed`);
}

test(
  "zz E-6 probe on Windows: the conforming stand-in passes the whole fixture",
  { timeout: BUDGET_MS },
  async () => {
    const started = Date.now();
    const run = await runE6RepresentativeFixture(binding("conform"));
    console.log(
      `[zz-e6] conform: PASS in ${String(Date.now() - started)} ms, ` +
        `${String(run.steps.length)} steps: ${run.steps.map((s) => s.step).join(" ")}`,
    );
    expect(run.steps.map((s) => s.step).slice(13, 16)).toEqual([
      "at",
      "move-busy",
      "rename",
    ]);
  },
);

test(
  "zz E-6 probe on Windows: every entry read alive fails diagnosed at the reuse check",
  { timeout: BUDGET_MS },
  async () => {
    const error = await failure("alive");
    expect(error.name).toBe("HarnessAssertionError");
    // The Windows leg's wording (the Linux leg's names "group(s)").
    expect(error.message).toMatch(
      /no identifier of the killed (run's process|group)/,
    );
  },
);

test(
  "zz E-6 probe on Windows: no entry fails diagnosed after the kill",
  { timeout: BUDGET_MS },
  async () => {
    const error = await failure("noentry");
    expect(error.name).toBe("HarnessAssertionError");
    expect(error.message).toMatch(/found nothing at \.xspec\/lock/);
  },
);

test(
  "zz E-6 probe on Windows: an entry kept after the file-form move fails diagnosed there",
  { timeout: BUDGET_MS },
  async () => {
    const error = await failure("keepmove");
    expect(error.name).toBe("HarnessAssertionError");
    expect(error.message).toMatch(/step "move" .*nothing must be at/);
  },
);

test(
  "zz E-6 probe on Windows: a forced void restores the workspace and reruns to a pass",
  { timeout: BUDGET_MS },
  async () => {
    fs.rmSync(STATE_FILE, { force: true });
    state.voidNext = true;
    state.calls = 0;
    const started = Date.now();
    const run = await runE6RepresentativeFixture(binding("alivefirst"));
    console.log(
      `[zz-e6] alivefirst, forced void: PASS in ` +
        `${String(Date.now() - started)} ms, reuse check called ` +
        `${String(state.calls)} time(s), ${String(run.steps.length)} steps`,
    );
    expect(state.calls).toBe(1);
    expect(run.steps.length).toBe(26);
    fs.rmSync(STATE_FILE, { force: true });
  },
);
