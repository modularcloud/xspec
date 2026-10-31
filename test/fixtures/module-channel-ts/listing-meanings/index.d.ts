declare function defineConfig<T>(value: T): T;
declare namespace defineConfig {
  const version: number;
}

export { defineConfig };
export type { defineConfig as typeOnlyFunction };
export type * from "./star.js";
export default function declaredDefault(): void;
