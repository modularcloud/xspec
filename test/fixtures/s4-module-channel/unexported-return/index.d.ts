interface Hidden {
  readonly checked: boolean;
}

export interface Visible {
  readonly checked: boolean;
}

export declare function defineConfig(value: Hidden): Hidden;

export declare function defineVisible(value: Visible): Visible;

export {};
