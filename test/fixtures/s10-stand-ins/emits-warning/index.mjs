process.emitWarning("a warning the module emits while it loads", {
  type: "XspecS10Warning",
  code: "XSPEC_S10_EMITTED",
});

export function defineConfig(settings) {
  return settings;
}
