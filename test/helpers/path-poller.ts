// The concurrent polling reader of TEST-SPEC T13.5-5 (atomic visibility),
// shared with P-10 (CERTIFICATIONS.md §CONF-READERS: P-10's readers'
// observations share T13.5-5's polling machinery, certified via
// VIOL-CORE-PARTIALWRITE, at every path but the lock path, whose atomicity
// P-10 records as admitting no discriminating observation).
//
// A poller reads a fixed list of absolute paths in a tight loop — one
// observation cycle reads every path once, in list order, then yields about
// a millisecond — and records, per path, every distinct state it observed
// (absence a state like any other, contents deduplicated byte-exactly, each
// with the cycle that first observed it), the cycle of its first content,
// and the cycle of its last absence. A caller may also see every
// observation in order (`onObservation`), for order-dependent oracles such
// as P-10's journal prefix checks. The poller never throws while it runs:
// the first unexpected read error is recorded and diagnosed by the caller
// once the poller has stopped (H-8), its cycles counted all the same. Only
// a nonexistent path (ENOENT) reads as absence; any other refusal is an
// error. Its oracles — which states are legitimate, when absence is — are
// the callers' own: T13.5-5 judges its derived file against the completed
// builds' contents, P-10 each polled path against its states before and
// after each mutating command. No caller ever polls the lock path
// `.xspec/lock` or anything under it (P-10's paths are named explicitly,
// or listed in its spec sources' directories by 13.1's `NAME.xspec.`
// prefix).

import { Buffer } from "node:buffer";
import * as fsp from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";

/** One observed state of a polled path. */
export type PolledState =
  | { readonly kind: "absent" }
  | { readonly kind: "content"; readonly bytes: Uint8Array };

/** The absent state. */
export const ABSENT_STATE: PolledState = { kind: "absent" };

/** A byte-exact key for a state: equal keys, equal states. */
export function polledStateKey(state: PolledState): string {
  return state.kind === "absent"
    ? "absent"
    : `c:${Buffer.from(state.bytes).toString("latin1")}`;
}

/** A state rendered for a diagnosis. */
export function describePolledState(state: PolledState): string {
  return state.kind === "absent"
    ? "absent"
    : `${String(state.bytes.length)} bytes`;
}

/**
 * Read a path's state once: its content, or absence where nothing exists
 * there (ENOENT). Any other failure throws.
 */
export async function readPolledState(absPath: string): Promise<PolledState> {
  try {
    return { kind: "content", bytes: await fsp.readFile(absPath) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return ABSENT_STATE;
    }
    throw error;
  }
}

/** A distinct state a poller observed at one path. */
export interface PolledObservation {
  readonly state: PolledState;
  /** The observation cycle that first observed it. */
  readonly firstIndex: number;
}

/** What a poller recorded at one path. */
interface PathRecord {
  readonly distinct: Map<string, PolledObservation>;
  firstContentIndex: number;
  lastAbsentIndex: number;
}

/** Called for every observation, in order (module header). */
export type ObservationHook = (
  absPath: string,
  state: PolledState,
  cycle: number,
) => void;

/** The polling reader (module header). */
export class PathPoller {
  readonly #paths: readonly string[];
  readonly #records = new Map<string, PathRecord>();
  readonly #onObservation: ObservationHook | undefined;
  #cycles = 0;
  #error: string | undefined;
  #stop = false;
  #task: Promise<void> | undefined;

  constructor(paths: readonly string[], onObservation?: ObservationHook) {
    if (paths.length === 0) {
      throw new Error("PathPoller: at least one path must be polled");
    }
    this.#paths = paths;
    this.#onObservation = onObservation;
    for (const absPath of paths) {
      this.#records.set(absPath, {
        distinct: new Map(),
        firstContentIndex: -1,
        lastAbsentIndex: -1,
      });
    }
  }

  /**
   * Observation cycles begun so far: a cycle's index is the count when it
   * began, so a count read at some moment bounds the cycles begun before it.
   */
  get cycles(): number {
    return this.#cycles;
  }

  /** The first unexpected read error, as its diagnosis names it. */
  get error(): string | undefined {
    return this.#error;
  }

  /** Every distinct state observed at `absPath`, by state key. */
  distinct(absPath: string): ReadonlyMap<string, PolledObservation> {
    return this.#record(absPath).distinct;
  }

  /** The cycle of the first content observed at `absPath`; -1 for none. */
  firstContentIndex(absPath: string): number {
    return this.#record(absPath).firstContentIndex;
  }

  /** The cycle of the last absence observed at `absPath`; -1 for none. */
  lastAbsentIndex(absPath: string): number {
    return this.#record(absPath).lastAbsentIndex;
  }

  /** Begin polling (once). */
  start(): void {
    if (this.#task !== undefined) {
      throw new Error("PathPoller: start() called twice");
    }
    this.#task = this.#loop();
  }

  /** Stop polling and wait for the cycle in progress to finish. */
  async stop(): Promise<void> {
    this.#stop = true;
    await (this.#task ?? Promise.resolve());
  }

  #record(absPath: string): PathRecord {
    const record = this.#records.get(absPath);
    if (record === undefined) {
      throw new Error(`PathPoller: ${absPath} is not among the polled paths`);
    }
    return record;
  }

  async #loop(): Promise<void> {
    while (!this.#stop) {
      const cycle = this.#cycles;
      this.#cycles += 1;
      for (const absPath of this.#paths) {
        let state: PolledState;
        try {
          state = await readPolledState(absPath);
        } catch (error) {
          this.#error ??=
            `cycle #${String(cycle)} reading ${absPath}: ` +
            `${error instanceof Error ? error.message : String(error)}`;
          continue;
        }
        const record = this.#record(absPath);
        const key = polledStateKey(state);
        if (!record.distinct.has(key)) {
          record.distinct.set(key, { state, firstIndex: cycle });
        }
        if (state.kind === "absent") {
          record.lastAbsentIndex = cycle;
        } else if (record.firstContentIndex === -1) {
          record.firstContentIndex = cycle;
        }
        this.#onObservation?.(absPath, state, cycle);
      }
      await sleep(1);
    }
  }
}
