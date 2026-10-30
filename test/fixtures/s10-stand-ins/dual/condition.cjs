"use strict";

const kind = this === undefined ? "an ES module" : "a CommonJS module";
process.stdout.write(`condition.cjs: ${kind}${String.fromCharCode(10)}`);

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
