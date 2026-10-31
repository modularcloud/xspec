declare class Settings {
  defineConfig<T>(value: T): T;
}

declare const settings: Settings;

export = settings;
