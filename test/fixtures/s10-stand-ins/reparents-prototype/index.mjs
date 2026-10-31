Object.setPrototypeOf(
  Date.prototype,
  Object.create(Object.getPrototypeOf(Date.prototype)),
);

export function defineConfig(settings) {
  return settings;
}
