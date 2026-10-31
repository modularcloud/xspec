"use strict";

Object.setPrototypeOf(
  Date.prototype,
  Object.create(Object.getPrototypeOf(Date.prototype)),
);

exports.defineConfig = function defineConfig(settings) {
  return settings;
};
