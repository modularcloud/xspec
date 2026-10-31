"use strict";

const { writeFileSync } = require("node:fs");
const { homedir, tmpdir } = require("node:os");
const { join } = require("node:path");

const ownDirectory = __dirname;
const name = `writes-file-${process.pid}-${process.hrtime.bigint()}`;
for (const directory of [process.cwd(), homedir(), tmpdir(), ownDirectory]) {
  writeFileSync(join(directory, name), "written", { flag: "wx" });
}

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
