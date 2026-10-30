const emitWarning = process.emitWarning;
process.emitWarning = function xspecS10EmitWarning(...args) {
  return Reflect.apply(emitWarning, this, args);
};

export function defineConfig(settings) {
  return settings;
}
