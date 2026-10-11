// TEMPORARY (FIX_PLAN Task 37 Windows-leg probe; removed in the next
// commit): T11.6-1's drive-mismatch arm (`runT1161DriveMismatchArm`) run on
// the Windows leg against the built product behind the scratch stand-in
// zz-t9j2-37-relinv.mjs — `lock` inserts the inventory's missing `lock`
// member (the built product's 13.5 lock is still in the temporary folder)
// and is the conforming reference, every other mode one deviation in the
// answers of runs away from the workspace root (or, for `vacuous`, in every
// answer). Each case asserts the arm's verdict and prints its diagnosis.

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import { runT1161DriveMismatchArm } from "../helpers/e6-drive-mismatch-arm.js";
import type { ProductBinding } from "../helpers/subprocess.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STANDIN = path.join(HERE, "zz-t9j2-37-relinv.mjs");
const BIN = path.resolve(HERE, "..", "..", "dist", "cli", "bin.js");

function binding(mode: string): ProductBinding {
  return {
    label: `zz-t9j2-37-relinv ${mode}`,
    command: process.execPath,
    prefixArgs: [STANDIN, mode, BIN],
    requiredFiles: [STANDIN, BIN],
  };
}

const CASES: readonly (readonly [string, "pass" | string])[] = [
  ["lock", "pass"],
  ["rellock", "the lock path is reported as its workspace-relative path"],
  ["relall", "the graph-data area is reported as its workspace-relative"],
  ["relsessions", "`sessions` differs"],
  ["cwdjournal", "`journal` differs"],
  ["cwdrecorded", "`recorded` differs"],
  ["relconfig", "`configuration` differs"],
  ["vacuous", "every path-bearing member of the root run's answer"],
];

for (const [mode, expected] of CASES) {
  test(
    `zz T11.6-1 drive-mismatch arm via relinv ${mode}: ${expected}`,
    { timeout: 180_000 },
    async () => {
      let outcome = "pass";
      let diagnosis = "";
      try {
        await runT1161DriveMismatchArm(binding(mode));
      } catch (error) {
        outcome =
          error instanceof HarnessAssertionError
            ? "fail"
            : `error (${error instanceof Error ? error.constructor.name : typeof error})`;
        diagnosis = error instanceof Error ? error.message : String(error);
      }
      console.info(`ZZPROBE ${mode}: ${outcome}: ${diagnosis}`);
      if (expected === "pass") {
        expect(outcome).toBe("pass");
      } else {
        expect(outcome).toBe("fail");
        expect(diagnosis).toContain(expected);
      }
    },
  );
}
