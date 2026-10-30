const kind = this === undefined ? "an ES module" : "a CommonJS module";
process.stdout.write(`index.mjs: ${kind}${String.fromCharCode(10)}`);

export function defineConfig(settings) {
  return settings;
}
