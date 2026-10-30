const LF = String.fromCharCode(10);
process.nextTick(() => {
  process.stderr.write(
    `(node:${process.pid}) [XSPEC_S10_FORGED] Warning: a line the module ` +
      `writes after the release's own warning${LF}`,
  );
});

export function defineConfig(settings) {
  return settings;
}
