process.stdout.write(
  `prints-stdout: a line the module writes${String.fromCharCode(10)}`,
);

export function defineConfig(settings) {
  return settings;
}
