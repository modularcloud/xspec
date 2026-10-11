// TEMPORARY CI probe (FIX_PLAN Task 26 of the plan written at 772854b;
// removed by that task's last commit): T13.5-10's arms needing
// administrative access — (e) on another machine, (f), and (g)
// (`runT13510MachineArms`) — need CI's Linux legs (TEST-SPEC E-1; AGENTS.md:
// nothing needing it runs in the sandbox), so this file runs them there:
// against the CONF-CORE conformer (a 13.5 reference, never a gate) — the
// whole T13.5-10 and the machine arms alone, (g)'s outcome per command
// printed — against scratch stand-ins, each a copy of the conformer with one
// deviation (the liveness checks: each must fail at its own arm, diagnosed),
// and against the built product (diagnosed). Every result is printed, its
// full diagnosis included, to the job's log.

import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, onTestFinished, test } from "vitest";
import type { ProductTestEntry } from "../helpers/registry.js";
import type { ProductBinding } from "../helpers/subprocess.js";
import { builtProductBinding } from "../helpers/subprocess.js";
import { productTestSuite } from "../suite/registry/index.js";
import type { GapReport } from "../suite/registry/section-13.5-ii.js";
import { runT13510MachineArms } from "../suite/registry/section-13.5-ii.js";
import type { ProductTestResult } from "./certification-runner.js";
import { runProductTests } from "./certification-runner.js";

const CONF_CORE = fileURLToPath(
  new URL("../fixtures/conf-core", import.meta.url),
);

const [T13_5_10] = productTestSuite.select(["T13.5-10"]);

function fixture(dir: string, label: string): ProductBinding {
  const bin = path.join(dir, "bin.mjs");
  return {
    label,
    command: process.execPath,
    prefixArgs: [bin],
    requiredFiles: [bin],
  };
}

/** T13.5-10 cut to its machine arms, (g)'s outcomes pushed to `outcomes`. */
function machineArmsAlone(outcomes: GapReport[]): ProductTestEntry {
  if (T13_5_10 === undefined) throw new Error("T13.5-10 is not registered");
  return {
    ...T13_5_10,
    run: async (product) => {
      outcomes.push(...(await runT13510MachineArms(product)));
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
    `[zz-t26] ${what} against ${binding.label}: ${result.outcome} in ` +
      `${String(Date.now() - started)} ms` +
      (result.diagnosis === null ? "" : `\n${result.diagnosis}`),
  );
  return result;
}

/** One deviation: `from` replaced by `to`, `from` found exactly once. */
interface Deviation {
  readonly from: string;
  readonly to: string;
}

/** A copy of the conformer with `deviations` applied, in a scratch dir. */
async function standin(
  name: string,
  deviations: readonly Deviation[],
): Promise<ProductBinding> {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), `xspec-zz-t26-${name}-`),
  );
  onTestFinished(() => fsp.rm(dir, { recursive: true, force: true }));
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
  await fsp.writeFile(path.join(dir, "product.mjs"), source);
  await fsp.copyFile(
    path.join(CONF_CORE, "bin.mjs"),
    path.join(dir, "bin.mjs"),
  );
  return fixture(dir, `stand-in ${name}`);
}

const BUDGET_MS = 1_500_000;

test(
  "CONF-CORE passes the whole T13.5-10, machine arms included",
  async () => {
    if (T13_5_10 === undefined) throw new Error("T13.5-10 is not registered");
    const result = await runAndPrint(
      fixture(CONF_CORE, "CONF-CORE"),
      T13_5_10,
      "the whole T13.5-10",
    );
    expect(result.outcome, result.diagnosis ?? "").toBe("pass");
  },
  BUDGET_MS,
);

test(
  "CONF-CORE passes the machine arms alone; (g)'s outcome per command",
  async () => {
    const outcomes: GapReport[] = [];
    const result = await runAndPrint(
      fixture(CONF_CORE, "CONF-CORE"),
      machineArmsAlone(outcomes),
      "the machine arms alone",
    );
    console.log(`[zz-t26] (g)'s outcomes: ${JSON.stringify(outcomes)}`);
    expect(result.outcome, result.diagnosis ?? "").toBe("pass");
    expect(outcomes).toHaveLength(5);
  },
  BUDGET_MS,
);

const STANDINS: readonly {
  readonly name: string;
  readonly deviations: readonly Deviation[];
  readonly expected: readonly RegExp[];
}[] = [
  {
    // The plan's red check for (f): an entry named by the identifier alone,
    // created over whatever stands there (no O_EXCL).
    name: "name-by-identifier",
    deviations: [
      {
        from: '  return `${String(process.pid)}-${randomBytes(8).toString("hex")}`;',
        to: "  return String(process.pid);",
      },
      {
        from: "const ENTRY_NAME = /^([1-9][0-9]*)-[0-9a-f]{16}$/;",
        to: "const ENTRY_NAME = /^([1-9][0-9]*)$/;",
      },
      {
        from: '    const handle = await fsp.open(path.join(lockAbs, name), "wx");',
        to: '    const handle = await fsp.open(path.join(lockAbs, name), "w");',
      },
    ],
    expected: [
      /^T13\.5-10\(f\) /,
      /two runs' entries must bear byte-different names/,
    ],
  },
  {
    // (f): an entry recording the acquirer's own identifier judged by the
    // process list, which lists it.
    name: "refuses-own-identifier",
    deviations: [
      {
        from: "      if (identifier !== process.pid) {",
        to: "      if (identifier !== null) {",
      },
    ],
    expected: [/^T13\.5-10\(f\) /, /it exited first/, /workspace-busy/],
  },
  {
    // (e) on another machine: every entry recording another identifier
    // judged live, whatever the process list lists.
    name: "every-entry-live",
    deviations: [
      {
        from: "        if (listed(identifier)) {",
        to: "        if (listed !== null) {",
      },
    ],
    expected: [
      /^T13\.5-10\(e\) .* started on another machine/,
      /though its namespace has allocated no identifier as large as/,
    ],
  },
  {
    // (g): a busy refusal's release sweeping the lock directory whole.
    name: "refusal-sweeps",
    deviations: [
      {
        from: "  } catch (error) {\n    await release();\n    throw error;\n  }",
        to:
          "  } catch (error) {\n    await release();\n" +
          '    if (error?.code === "workspace-busy") {\n' +
          "      await fsp.rm(lockAbs, { recursive: true, force: true }).catch(() => {});\n" +
          "    }\n    throw error;\n  }",
      },
    ],
    expected: [
      /^T13\.5-10\(g\) /,
      /the entry in the gap stands byte-identical/,
    ],
  },
];

for (const { name, deviations, expected } of STANDINS) {
  test(
    `stand-in ${name} fails the machine arms at its own arm, diagnosed`,
    async () => {
      const outcomes: GapReport[] = [];
      const result = await runAndPrint(
        await standin(name, deviations),
        machineArmsAlone(outcomes),
        "the machine arms alone",
      );
      expect(result.outcome, result.diagnosis ?? "").toBe("fail");
      for (const pattern of expected) {
        expect(result.diagnosis ?? "").toMatch(pattern);
      }
    },
    BUDGET_MS,
  );
}

test(
  "the built product fails the machine arms, diagnosed",
  async () => {
    const outcomes: GapReport[] = [];
    const result = await runAndPrint(
      builtProductBinding(),
      machineArmsAlone(outcomes),
      "the machine arms alone",
    );
    expect(result.outcome, result.diagnosis ?? "").toBe("fail");
  },
  BUDGET_MS,
);
