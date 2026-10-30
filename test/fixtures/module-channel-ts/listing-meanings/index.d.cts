declare const marker: unique symbol;

declare const api: {
  defineConfig<T>(value: T): T;
  readonly [marker]: true;
};

declare namespace api {
  type defineConfig = string;
  interface Options {
    readonly note: string;
  }
}

export = api;
