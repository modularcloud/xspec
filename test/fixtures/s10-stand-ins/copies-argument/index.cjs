"use strict";

exports.defineConfig = function defineConfig(settings) {
  if (Array.isArray(settings)) return settings.slice();
  if (typeof settings === "object" && settings !== null) {
    return Object.assign({}, settings);
  }
  return settings;
};
