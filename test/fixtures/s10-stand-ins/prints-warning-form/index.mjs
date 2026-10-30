import { basename } from "node:path";

const LF = String.fromCharCode(10);
const hint =
  "(Use `" +
  basename(process.argv0 || "node", ".exe") +
  " --trace-warnings ...` to show where the warning was created)";
process.stderr.write(
  `(node:${process.pid}) [XSPEC_S10_FORGED] Warning: a line the module ` +
    `writes in the warning form${LF}${hint}${LF}`,
);

export function defineConfig(settings) {
  return settings;
}
