type Settings = {
  groups: { [name: string]: string[] };
  output?: { enabled: boolean };
};

export declare function defineConfig(settings: Settings): Settings;

declare global {
  interface RangeError {
    name: number;
  }
}

export {};
