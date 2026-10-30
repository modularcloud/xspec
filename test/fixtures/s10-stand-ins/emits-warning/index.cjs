"use strict";

process.emitWarning("a warning the module emits while it loads", {
  type: "XspecS10Warning",
  code: "XSPEC_S10_EMITTED",
});

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
