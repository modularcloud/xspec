process.stderr.write(
  `prints-stderr: a line the module writes${String.fromCharCode(10)}`,
);

export function defineConfig(settings) {
  return settings;
}
