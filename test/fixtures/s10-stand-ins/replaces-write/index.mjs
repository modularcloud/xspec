for (const stream of [process.stdout, process.stderr]) {
  const write = stream.write;
  stream.write = function xspecS10Write(...args) {
    return Reflect.apply(write, this, args);
  };
}

export function defineConfig(settings) {
  return settings;
}
