"use strict";

process.stderr.write(
  `prints-stderr: a line the module writes${String.fromCharCode(10)}`,
);

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
