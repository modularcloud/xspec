// Self-checks for E-6's exclusion probe, its platform half (TEST-SPEC 17
// preamble: internal self-tests cover harness machinery certification does
// not exercise; E-6, T13.5-3, H-11; helpers/e6-exclusion.ts). Only the
// Windows CI leg reads Windows' process list, so its reading is pinned here,
// on the Linux leg, over the process-list script's exact output: one line
// `<pid> <ppid> <created>` per process, then `END <count>` — anything else,
// a truncated listing included, refused as a harness error, never read as a
// short list — and the run's process tree selected from it: the started
// process and its descendants, a parent link counting only from a parent
// created no later than its child (a recurring identifier is never taken
// for a process of the tree). On this leg the reuse check dispatches to
// T13.5-3's (`applyReuseCheck`): an identifier of the killed run listed
// again voids the trial, none listed fails diagnosed. The kill itself and
// the probe's end-to-end red-green are the representative fixture's
// (helpers/e6.ts), run by the E-6 writer test and the Windows leg.

import { expect, test } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import {
  e6ReuseCheck,
  parseWindowsProcessList,
  windowsProcessTree,
} from "../helpers/e6-exclusion.js";
import type { WindowsProcess } from "../helpers/e6-exclusion.js";
import { TrialVoided } from "../helpers/kill-discipline.js";

test("E-6 exclusion probe: Windows' process list reads as the script writes it — one `<pid> <ppid> <created>` line per process, ended CR LF or LF, then `END <count>`", () => {
  expect(
    parseWindowsProcessList(
      "0 0 0\r\n4 0 133700000000000000\r\n1200 900 133800000000000123\r\nEND 3\r\n",
    ),
  ).toEqual([
    { pid: 0, ppid: 0, created: 0n },
    { pid: 4, ppid: 0, created: 133700000000000000n },
    { pid: 1200, ppid: 900, created: 133800000000000123n },
  ]);
  expect(parseWindowsProcessList("7 1 5\nEND 1")).toEqual([
    { pid: 7, ppid: 1, created: 5n },
  ]);
  expect(parseWindowsProcessList("END 0\r\n")).toEqual([]);
});

test("E-6 exclusion probe: a listing that is not the script's whole output — no END line, a count the lines do not meet, a line of another shape — is refused, never read as a short list (H-11)", () => {
  expect(() => parseWindowsProcessList("")).toThrow(/END line/);
  expect(() => parseWindowsProcessList("4 0 1\r\n8 4 2\r\n")).toThrow(
    /END line/,
  );
  expect(() => parseWindowsProcessList("4 0 1\r\n8 4 2\r\nEND 3\r\n")).toThrow(
    /counts 3/,
  );
  expect(() =>
    parseWindowsProcessList("4 0 1\r\nWARNING: slow\r\nEND 2\r\n"),
  ).toThrow(/line 2/);
  expect(() => parseWindowsProcessList("4 0 -1\r\nEND 1\r\n")).toThrow(
    /line 1/,
  );
  expect(() => parseWindowsProcessList("4 0 1 9\r\nEND 1\r\n")).toThrow(
    /line 1/,
  );
});

test("E-6 exclusion probe: the run's process tree is the started process and every descendant, ascending — a parent link counting only from a parent created no later than its child", () => {
  const list: WindowsProcess[] = [
    { pid: 200, ppid: 4, created: 5n },
    { pid: 108, ppid: 104, created: 12n },
    { pid: 100, ppid: 4, created: 10n },
    // Created before 100: its parent identifier named another process,
    // since ended, that 100 reuses — no child of 100's, nor its own child.
    { pid: 96, ppid: 100, created: 9n },
    { pid: 112, ppid: 96, created: 13n },
    { pid: 104, ppid: 100, created: 11n },
    { pid: 116, ppid: 100, created: 10n },
  ];
  expect(windowsProcessTree(list, 100).map((entry) => entry.pid)).toEqual([
    100, 104, 108, 116,
  ]);
  expect(windowsProcessTree(list, 108).map((entry) => entry.pid)).toEqual([
    108,
  ]);
  expect(windowsProcessTree(list, 300)).toEqual([]);
  // The idle process lists itself as its own parent: no cycle.
  expect(
    windowsProcessTree([{ pid: 0, ppid: 0, created: 0n }], 0).map(
      (entry) => entry.pid,
    ),
  ).toEqual([0]);
});

test("E-6 exclusion probe: on this leg the reuse check is T13.5-3's — an identifier of the killed run listed again voids the trial; none listed fails, diagnosed", async () => {
  // This process stands for a reused identifier: it is listed.
  await expect(
    e6ReuseCheck({ identifiers: [process.pid] }, "a refused run"),
  ).rejects.toBeInstanceOf(TrialVoided);
  // Beyond Linux's largest process identifier (PID_MAX_LIMIT, 2^22): never
  // listed.
  await expect(
    e6ReuseCheck({ identifiers: [2 ** 22 + 1] }, "a refused run"),
  ).rejects.toBeInstanceOf(HarnessAssertionError);
});
