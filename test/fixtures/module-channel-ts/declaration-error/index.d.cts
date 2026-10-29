type Settings = {
  groups: { [name: string]: string[] };
  output?: { enabled: boolean };
};

export declare function defineConfig(settings: Settings): Settings;

declare const broken: MissingType;

export {};
