"use strict";

const emitWarning = process.emitWarning;
process.emitWarning = function xspecS10EmitWarning(...args) {
  return Reflect.apply(emitWarning, this, args);
};

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
