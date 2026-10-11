// TEMPORARY CI probe (FIX_PLAN Task 31 of the plan written at 772854b;
// removed by that task's next commit): T13.5-9's arms needing administrative
// access — (c)'s second mount, (d), and (d) again (`runT1359MachineArms`) —
// need CI's Linux legs (TEST-SPEC E-1; AGENTS.md: nothing needing it runs in
// the sandbox), so this file runs them there: against the CONF-CORE
// conformer (a 13.5 reference, never a gate) — the whole T13.5-9, every
// arm's endings printed, (d)'s among them — against scratch stand-ins, each
// a copy of the conformer with one deviation (the liveness checks: each must
// fail at its own arm, diagnosed), and against the built product
// (diagnosed). Every result is printed, its full diagnosis included, to the
// job's log.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vitest";
import type { ProductTestEntry } from "../helpers/registry.js";
import type { ProductBinding } from "../helpers/subprocess.js";
import { builtProductBinding } from "../helpers/subprocess.js";
import { productTestSuite } from "../suite/registry/index.js";
import type { ArmReport } from "../suite/registry/section-13.5-v.js";
import {
  runT1359MachineArms,
  runT1359PlainArms,
} from "../suite/registry/section-13.5-v.js";
import type { ProductTestResult } from "./certification-runner.js";
import { runProductTests } from "./certification-runner.js";

const CONF_CORE = fileURLToPath(
  new URL("../fixtures/conf-core", import.meta.url),
);
const [T13_5_9] = productTestSuite.select(["T13.5-9"]);

function fixture(dir: string, label: string): ProductBinding {
  const bin = path.join(dir, "bin.mjs");
  return {
    label,
    command: process.execPath,
    prefixArgs: [bin],
    requiredFiles: [bin],
  };
}

/** T13.5-9 whole, every arm's report pushed to `reports`. */
function wholeTest(reports: ArmReport[]): ProductTestEntry {
  if (T13_5_9 === undefined) throw new Error("T13.5-9 is not registered");
  return {
    ...T13_5_9,
    run: async (product) => {
      reports.push(...(await runT1359PlainArms(product)));
      reports.push(...(await runT1359MachineArms(product)));
    },
  };
}

/** T13.5-9 cut to its machine arms, each arm's report pushed to `reports`. */
function machineArmsAlone(reports: ArmReport[]): ProductTestEntry {
  if (T13_5_9 === undefined) throw new Error("T13.5-9 is not registered");
  return {
    ...T13_5_9,
    run: async (product) => {
      reports.push(...(await runT1359MachineArms(product)));
    },
  };
}

async function runAndPrint(
  binding: ProductBinding,
  entry: ProductTestEntry,
  what: string,
): Promise<ProductTestResult> {
  const started = Date.now();
  const [result] = (await runProductTests(binding, [entry])).results;
  if (result === undefined) throw new Error("no result");
  console.log(
    `[zz-t31] ${what} against ${binding.label}: ${result.outcome} in ` +
      `${String(Date.now() - started)} ms` +
      (result.diagnosis === null ? "" : `\n${result.diagnosis}`),
  );
  return result;
}

interface Deviation {
  readonly from: string;
  readonly to: string;
}

const OUTSIDE_EXCLUSION: readonly Deviation[] = [
  {
    from: 'import * as path from "node:path";',
    to: 'import * as os from "node:os";\nimport * as path from "node:path";',
  },
  {
    from:
      "      await judgeLockDirectory(Buffer.from(lockAbs), names, held.entry);\n" +
      "      return { release };",
    to: "      await outsideExclusion(root, held);\n      return { release };",
  },
  {
    from: "    if (held.createdArea) await deleteQuietly(() => fsp.rmdir(areaAbs));\n  };",
    to:
      "    if (held.createdArea) await deleteQuietly(() => fsp.rmdir(areaAbs));\n" +
      "    if (held.outside) await deleteQuietly(() => fsp.unlink(held.outside));\n  };",
  },
];

const OUTSIDE_EXCLUSION_FUNCTION = `
async function outsideExclusion(root, held) {
  const file = await outsideLockFile(root);
  try {
    const handle = await fsp.open(file, "wx");
    await handle.close();
  } catch (error) {
    if (error?.code === "EEXIST") throw workspaceBusy();
    throw error;
  }
  held.outside = file;
}
void os;
`;

const KEYS: Readonly<Record<string, string>> = {
  tmpdir: `
async function outsideLockFile(root) {
  const stats = await fsp.stat(root);
  return path.join(os.tmpdir(), \`xspec-standin-tmpdir-\${stats.dev}-\${stats.ino}\`);
}
`,
  cwd: `
async function outsideLockFile() {
  const key = createHash("sha256").update(await fsp.realpath(process.cwd())).digest("hex").slice(0, 32);
  return path.join("/tmp", \`xspec-standin-cwd-\${key}\`);
}
`,
  spelling: `
async function outsideLockFile(root) {
  const pwd = process.env.PWD;
  let logical = process.cwd();
  if (pwd !== undefined && path.isAbsolute(pwd)) {
    const real = await fsp.realpath(pwd).catch(() => null);
    if (real === process.cwd()) logical = pwd;
  }
  const spelled = path.join(logical, path.relative(process.cwd(), root));
  const key = createHash("sha256").update(spelled).digest("hex").slice(0, 32);
  return path.join("/tmp", \`xspec-standin-spelling-\${key}\`);
}
`,
  peruser: `
async function outsideLockFile(root) {
  const stats = await fsp.stat(root);
  return path.join("/tmp", \`xspec-standin-peruser-\${process.getuid()}-\${stats.dev}-\${stats.ino}\`);
}
`,
};

async function standin(
  name: string,
  deviations: readonly Deviation[],
  appended: string,
): Promise<ProductBinding> {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), `xspec-zz-t31-${name}-`),
  );
  onTestFinished(() => fsp.rm(dir, { recursive: true, force: true }));
  await fsp.chmod(dir, 0o755);
  let source = await fsp.readFile(path.join(CONF_CORE, "product.mjs"), "utf8");
  for (const { from, to } of deviations) {
    const count = source.split(from).length - 1;
    if (count !== 1) {
      throw new Error(
        `stand-in ${name}: ${JSON.stringify(from)} found ${String(count)} times`,
      );
    }
    source = source.replace(from, to);
  }
  await fsp.writeFile(path.join(dir, "product.mjs"), source + appended);
  await fsp.copyFile(
    path.join(CONF_CORE, "bin.mjs"),
    path.join(dir, "bin.mjs"),
  );
  for (const file of ["product.mjs", "bin.mjs"]) {
    await fsp.chmod(path.join(dir, file), 0o644);
  }
  return fixture(dir, `stand-in ${name}`);
}

const KILL_PROBE: readonly Deviation[] = [
  {
    from:
      "  if (!listed.has(process.pid)) return pidAlive;\n" +
      "  return (pid) => listed.has(pid);",
    to:
      "  return (pid) => {\n    try {\n      process.kill(pid, 0);\n" +
      "      return true;\n    } catch {\n      return false;\n    }\n  };",
  },
];

const BUDGET_MS = 1_200_000;

test(
  "CONF-CORE passes the whole T13.5-9; every arm's endings printed",
  async () => {
    const reports: ArmReport[] = [];
    const result = await runAndPrint(
      fixture(CONF_CORE, "CONF-CORE"),
      wholeTest(reports),
      "the whole T13.5-9",
    );
    console.log(`[zz-t31] reports: ${JSON.stringify(reports, null, 1)}`);
    expect(result.outcome, result.diagnosis ?? "").toBe("pass");
    expect(reports).toHaveLength(7);
  },
  BUDGET_MS,
);

test(
  "stand-in tmpdir (its exclusion state under TMPDIR) fails the whole T13.5-9 at (a), diagnosed",
  async () => {
    const result = await runAndPrint(
      await standin(
        "tmpdir",
        OUTSIDE_EXCLUSION,
        OUTSIDE_EXCLUSION_FUNCTION + (KEYS["tmpdir"] ?? ""),
      ),
      wholeTest([]),
      "the whole T13.5-9",
    );
    expect(result.outcome, result.diagnosis ?? "").toBe("fail");
    expect(result.diagnosis ?? "").toMatch(
      /T13\.5-9\(a\) a different environment/,
    );
  },
  BUDGET_MS,
);

const MACHINE_STANDINS: readonly {
  readonly name: string;
  readonly deviations: readonly Deviation[];
  readonly appended: string;
  readonly expected: RegExp;
}[] = [
  {
    // Keyed by the spelling of the root's path: fails the second mount.
    name: "spelling",
    deviations: OUTSIDE_EXCLUSION,
    appended: OUTSIDE_EXCLUSION_FUNCTION + (KEYS["spelling"] ?? ""),
    expected:
      /T13\.5-9\(c\) a different path to the root \(through a second mount/,
  },
  {
    // Exclusion state per user: fails (d) — again, where the holder's own
    // lock directory refuses the second user's entry (write-failure).
    name: "peruser",
    deviations: OUTSIDE_EXCLUSION,
    appended: OUTSIDE_EXCLUSION_FUNCTION + (KEYS["peruser"] ?? ""),
    expected: /T13\.5-9\(d\) /,
  },
  {
    // A live holder of another user judged dead, its liveness probe
    // (signal 0) refused: fails (d) — again, where the holder's own lock
    // directory refuses the second user's entry (write-failure).
    name: "kill-probe",
    deviations: KILL_PROBE,
    appended: "",
    expected: /T13\.5-9\(d\) /,
  },
];

for (const { name, deviations, appended, expected } of MACHINE_STANDINS) {
  test(
    `stand-in ${name} fails the machine arms at its own arm, diagnosed`,
    async () => {
      const reports: ArmReport[] = [];
      const result = await runAndPrint(
        await standin(name, deviations, appended),
        machineArmsAlone(reports),
        "the machine arms alone",
      );
      console.log(`[zz-t31] reports: ${JSON.stringify(reports)}`);
      expect(result.outcome, result.diagnosis ?? "").toBe("fail");
      expect(result.diagnosis ?? "").toMatch(expected);
    },
    BUDGET_MS,
  );
}

test(
  "the built product fails the machine arms, diagnosed",
  async () => {
    const result = await runAndPrint(
      builtProductBinding(),
      machineArmsAlone([]),
      "the machine arms alone",
    );
    expect(result.outcome, result.diagnosis ?? "").toBe("fail");
  },
  BUDGET_MS,
);
