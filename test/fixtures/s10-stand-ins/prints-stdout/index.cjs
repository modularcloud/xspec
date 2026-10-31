"use strict";

process.stdout.write(
  `prints-stdout: a line the module writes${String.fromCharCode(10)}`,
);

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
