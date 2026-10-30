const trim = String.prototype.trim;
String.prototype.trim = function xspecS10Trim() {
  return Reflect.apply(trim, this, []);
};

export function defineConfig(settings) {
  return settings;
}
