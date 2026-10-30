"use strict";

const { open } = require("node:fs");
const { homedir } = require("node:os");
const { join, sep } = require("node:path");

const ownDirectory = __dirname;
const LF = String.fromCharCode(10);
const nodeModules = `${sep}node_modules${sep}`;
const importingDirectory = ownDirectory.slice(
  0,
  ownDirectory.lastIndexOf(nodeModules),
);
for (const directory of [process.cwd(), importingDirectory, homedir()]) {
  const fifo = join(directory, "xspec.config.ts");
  process.stdout.write(`opens-fifos: opening ${fifo}${LF}`);
  open(fifo, "r", (error) => {
    const outcome =
      error === null ? "opened" : `failed to open (${String(error.code)})`;
    process.stdout.write(`opens-fifos: ${outcome} ${fifo}${LF}`);
  });
}

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
