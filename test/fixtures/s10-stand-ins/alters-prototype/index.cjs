"use strict";

const trim = String.prototype.trim;
String.prototype.trim = function xspecS10Trim() {
  return Reflect.apply(trim, this, []);
};

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
