import { writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ownDirectory = dirname(fileURLToPath(import.meta.url));
const name = `writes-file-${process.pid}-${process.hrtime.bigint()}`;
for (const directory of [process.cwd(), homedir(), tmpdir(), ownDirectory]) {
  writeFileSync(join(directory, name), "written", { flag: "wx" });
}

export function defineConfig(settings) {
  return settings;
}
