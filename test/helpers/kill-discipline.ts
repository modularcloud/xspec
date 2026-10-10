// T13.5-3's exit-collection discipline and reuse check, as shared machinery
// (TEST-SPEC T13.5-3, E-5, H-11; SPEC 13.5). Harness machinery only: no
// product imports, no test framework dependence.
//
// - Why. SPEC 13.5 lets an entry whose recorded identifier, not the
//   acquirer's own, is still listed in the acquirer's process list refuse
//   acquisition (the gap): its run's process terminated but still listed, or
//   the identifier reused. So every test that kills a mutating run (T11.6-3,
//   T13.4-12, T13.5-3, T13.5-7's kill arm, T13.5-10, P-10, E-6's exclusion
//   probe on the Linux leg) or takes over a dead run's entry (T13.5-11(d))
//   starts the held command in a process group of its own (the subprocess
//   driver's `processGroup` run option), kills the whole group with SIGKILL,
//   collects the exit of the process it started, and confirms that no
//   process of the group remains listed in the process list before the next
//   step: `RunningProduct.killGroup` (helpers/subprocess.ts), built on the
//   readers and `confirmGroupGone` below.
// - The process list (the Linux leg's). The numeric entries of `/proc`: one
//   per process — a thread group, never a thread of one — a zombie
//   (terminated, not yet reaped) included. A group's members are the listed
//   processes whose process-group ID (`/proc/<pid>/stat`, field 5) is the
//   group's. A member orphaned by the kill is reaped by the process-
//   identifier namespace's first process (or the nearest subreaper), which
//   need not be prompt — this sandbox's first process reaps about once a
//   second — so confirming a group gone polls, bounded; exhaustion is the
//   harness error `ProcessGroupLingerError` (H-11), never a diagnosed
//   product failure. On any other platform every reader throws: E-6's
//   Windows leg terminates as E-6 states.
// - The reuse check. Should a later command be refused `workspace-busy`
//   (14.26), the harness checks the process list for the killed groups'
//   identifiers: any listed again voids the trial (`TrialVoided`), none
//   listed fails the test, diagnosed (`applyReuseCheck`).
// - Voidable trials. A trial may declare itself void (`voidTrial`, with its
//   reason) — through the reuse check, or an arm's own staging check
//   (T13.5-10(e)–(g)); `runVoidableTrial` reruns it, the trial building its
//   fresh state (a fresh workspace) itself on every attempt, up to a bounded
//   number of attempts. A voided trial is no failure (E-5); exhaustion is the
//   harness error `VoidedTrialsExhaustedError` naming every reason (H-11),
//   never a `HarnessAssertionError`; any other failure propagates as is, never
//   retried. A `TrialVoided` escaping every runner is a harness error too: it
//   is no `HarnessAssertionError`.
// - Processes started through `sudo` (T13.5-9, T13.5-10(e)–(g)) may be owned
//   by root, so signalling them is the machine stagings' concern
//   (helpers/machine-staging.ts, through the subprocess driver's launcher
//   run option); this module reads the process list and signals nothing.
//   `descendantsOf` reads a process's descendants, so a group kill made
//   through a launcher also waits for any process that left the group,
//   which the group's SIGKILL never reached: one still listed is
//   `ProcessGroupLingerError`, never a silent survivor.

import * as fsp from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { HarnessAssertionError } from "./assertions.js";

/**
 * Bound on a group kill: the started process's exit collected and every
 * process of the group gone from the process list (H-8: waits terminate).
 */
export const DEFAULT_GROUP_GONE_TIMEOUT_MS = 30_000;
/** Interval between two readings of the process list while polling. */
export const DEFAULT_PROCESS_LIST_POLL_MS = 10;
/** Attempts a voidable trial gets: the first and up to four reruns. */
export const DEFAULT_VOIDABLE_ATTEMPTS = 5;

const PROC = "/proc";
const PROCESS_ENTRY = /^[1-9][0-9]*$/;

/** One listed process, as `/proc/<pid>/stat` records it. */
export interface ListedProcess {
  readonly pid: number;
  /** Its one-letter state: `R`, `S`, `D`, `Z` (a zombie), and so on. */
  readonly state: string;
  /** Its parent's identifier. */
  readonly ppid: number;
  /** Its process-group ID (field 5). */
  readonly pgrp: number;
}

function requireLinux(what: string): void {
  if (process.platform !== "linux") {
    throw new Error(
      `${what}: the process list is read from ${PROC}, the Linux leg's ` +
        `(TEST-SPEC T13.5-3); this platform is ${process.platform}, where ` +
        `E-6's Windows leg terminates as E-6 states`,
    );
  }
}

/**
 * The process list: the identifier of every listed process, a zombie
 * included, a thread of a process never (the numeric entries of `/proc`).
 */
export async function readProcessList(): Promise<Set<number>> {
  requireLinux("readProcessList");
  const listed = new Set<number>();
  for (const name of await fsp.readdir(PROC)) {
    if (PROCESS_ENTRY.test(name)) listed.add(Number(name));
  }
  return listed;
}

/**
 * The process `pid` names, as its `/proc/<pid>/stat` reads now; undefined
 * once nothing bears that identifier. Meant for identifiers the process list
 * lists (`/proc/<tid>` also answers for a thread).
 */
export async function readListedProcess(
  pid: number,
): Promise<ListedProcess | undefined> {
  requireLinux("readListedProcess");
  let text: string;
  try {
    text = await fsp.readFile(`${PROC}/${String(pid)}/stat`, "latin1");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ESRCH") return undefined;
    throw error;
  }
  // `pid (comm) state ppid pgrp …`: comm may hold spaces and parentheses, so
  // the fields after it are read from its last closing parenthesis.
  const close = text.lastIndexOf(")");
  const fields = close < 0 ? [] : text.slice(close + 2).split(" ");
  const [state, ppid, pgrp] = fields;
  if (
    state === undefined ||
    ppid === undefined ||
    pgrp === undefined ||
    !/^-?[0-9]+$/.test(ppid) ||
    !/^-?[0-9]+$/.test(pgrp)
  ) {
    throw new Error(
      `${PROC}/${String(pid)}/stat does not read as \`pid (comm) state ppid ` +
        `pgrp …\`: ${JSON.stringify(text.slice(0, 200))}`,
    );
  }
  return { pid, state, ppid: Number(ppid), pgrp: Number(pgrp) };
}

/** Every listed process of process group `groupId`, ascending. */
export async function processGroupMembers(
  groupId: number,
): Promise<ListedProcess[]> {
  const listed = await Promise.all(
    [...(await readProcessList())].map((pid) => readListedProcess(pid)),
  );
  return listed
    .filter((entry): entry is ListedProcess => entry?.pgrp === groupId)
    .sort((a, b) => a.pid - b.pid);
}

/**
 * Every listed descendant of process `pid` — its children, theirs, and so
 * on — ascending, as the process list's parent links read now: a process
 * orphaned since was reparented and no longer counts.
 */
export async function descendantsOf(pid: number): Promise<number[]> {
  const listed = await Promise.all(
    [...(await readProcessList())].map((id) => readListedProcess(id)),
  );
  const children = new Map<number, number[]>();
  for (const entry of listed) {
    if (entry === undefined) continue;
    const siblings = children.get(entry.ppid) ?? [];
    siblings.push(entry.pid);
    children.set(entry.ppid, siblings);
  }
  const found = new Set<number>();
  const pending = [pid];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    for (const child of children.get(next) ?? []) {
      if (found.has(child) || child === pid) continue;
      found.add(child);
      pending.push(child);
    }
  }
  return ascending(found);
}

/** Which of `identifiers` the process list lists now, ascending. */
export async function listedAmong(
  identifiers: Iterable<number>,
): Promise<number[]> {
  const listed = await readProcessList();
  return ascending(new Set(identifiers)).filter((id) => listed.has(id));
}

function ascending(identifiers: Iterable<number>): number[] {
  return [...identifiers].sort((a, b) => a - b);
}

/** A listed process rendered for a diagnosis. */
function describeListed(pid: number, entry: ListedProcess | undefined): string {
  return entry === undefined
    ? `${String(pid)} (gone by the time it was described)`
    : `${String(pid)} (state ${entry.state}, parent ${String(entry.ppid)}, ` +
        `group ${String(entry.pgrp)})`;
}

/** What a group kill could not confirm within its bound. */
export type GroupLingerStage = "exit" | "listed";

/**
 * A group kill that could not complete T13.5-3's discipline within its
 * bound: the started process's exit was never collected (`"exit"`), or some
 * process of the group stayed listed in the process list (`"listed"`) — a
 * process stuck in uninterruptible sleep, or orphans the process-identifier
 * namespace's first process never reaps. A harness error (H-11): the next
 * step cannot start, and nothing here is a product verdict — never a
 * `HarnessAssertionError`, never a skip.
 */
export class ProcessGroupLingerError extends Error {
  /** The killed group's ID: its started process's identifier. */
  readonly groupId: number;
  readonly stage: GroupLingerStage;
  /** The identifiers still listed when the bound ran out, ascending. */
  readonly lingering: readonly number[];

  constructor(
    what: string,
    groupId: number,
    stage: GroupLingerStage,
    waitedMs: number,
    described: readonly string[],
    lingering: readonly number[],
  ) {
    super(
      `harness error (H-11): T13.5-3's exit-collection discipline could not ` +
        `confirm process group ${String(groupId)} of ${what} gone: ` +
        (stage === "exit"
          ? `the exit of the process it started was not collected `
          : `processes of the group were still listed in the process list, ` +
            `a zombie counting as listed, `) +
        `${String(waitedMs)} ms after SIGKILL reached the group` +
        (described.length > 0
          ? ` — still listed: ${described.join(", ")}`
          : "") +
        ` — the next step cannot start; never a diagnosed product failure`,
    );
    this.name = "ProcessGroupLingerError";
    this.groupId = groupId;
    this.stage = stage;
    this.lingering = lingering;
  }
}

/** Options bounding a confirmation that a group is gone. */
export interface GroupGoneOptions {
  /** Bound on the whole confirmation (default 30 s). */
  readonly timeoutMs?: number;
  /** Interval between readings of the process list (default 10 ms). */
  readonly pollIntervalMs?: number;
}

/**
 * Confirm that process group `groupId` — killed by SIGKILL, which reached
 * every member at once, so none forks after it — is gone: read the group's
 * members once more, then poll the process list until neither those nor
 * `recorded` (the members read before the kill, the started process
 * included) is listed, a zombie counting as listed. Resolves with every
 * identifier the group's processes bore, ascending: the identifiers T13.5-3's
 * reuse check looks for. `what` names the killed run in a diagnosis;
 * exhaustion of the bound is `ProcessGroupLingerError` (H-11).
 */
export async function confirmGroupGone(
  groupId: number,
  recorded: Iterable<number>,
  what: string,
  options: GroupGoneOptions = {},
): Promise<number[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_GROUP_GONE_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_PROCESS_LIST_POLL_MS;
  const started = Date.now();
  const identifiers = new Set(recorded);
  // A member forked between the caller's reading and the kill bears the
  // group's ID until it is reaped.
  for (const member of await processGroupMembers(groupId)) {
    identifiers.add(member.pid);
  }
  for (;;) {
    const lingering = await listedAmong(identifiers);
    if (lingering.length === 0) return ascending(identifiers);
    const waitedMs = Date.now() - started;
    if (waitedMs >= timeoutMs) {
      const described = await Promise.all(
        lingering.map(async (pid) =>
          describeListed(pid, await readListedProcess(pid)),
        ),
      );
      throw new ProcessGroupLingerError(
        what,
        groupId,
        "listed",
        waitedMs,
        described,
        lingering,
      );
    }
    await sleep(pollIntervalMs);
  }
}

// ---------------------------------------------------------------------------
// Voidable trials (T13.5-3's reuse check, T13.5-10(e)–(g); E-5)

/**
 * A trial declaring itself void: thrown by `voidTrial` (and so by
 * `applyReuseCheck`), caught by `runVoidableTrial`, which reruns the trial.
 * Never a `HarnessAssertionError`: a voided trial is no failure (E-5), and
 * one escaping every runner is a harness error.
 */
export class TrialVoided extends Error {
  /** Why the trial is void, as its diagnosis names it. */
  readonly reason: string;

  constructor(reason: string) {
    super(
      `trial voided (E-5: no failure — runVoidableTrial reruns it from ` +
        `fresh state; one escaping every runner is a harness error): ${reason}`,
    );
    this.name = "TrialVoided";
    this.reason = reason;
  }
}

/** Declare the running trial void, with its reason (throws `TrialVoided`). */
export function voidTrial(reason: string): never {
  throw new TrialVoided(reason);
}

/**
 * Every attempt of a voidable trial was voided, so it never reached a
 * verdict: a harness error (H-11; TEST-SPEC T13.5-3: exhaustion a harness
 * error) naming each attempt's reason — never a `HarnessAssertionError`,
 * never a pass, never a skip.
 */
export class VoidedTrialsExhaustedError extends Error {
  /** The trial, as its caller names it. */
  readonly label: string;
  /** Each voided attempt's reason, in attempt order. */
  readonly reasons: readonly string[];

  constructor(label: string, reasons: readonly string[]) {
    super(
      `harness error (H-11): ${label}: all ${String(reasons.length)} ` +
        `attempts were voided, so the trial never reached a verdict — ` +
        `never a diagnosed product failure, never a pass (TEST-SPEC ` +
        `T13.5-3, E-5); reasons: ` +
        reasons
          .map((reason, index) => `(${String(index + 1)}) ${reason}`)
          .join("; "),
    );
    this.name = "VoidedTrialsExhaustedError";
    this.label = label;
    this.reasons = reasons;
  }
}

/** The reason of a `TrialVoided`, or undefined for anything else. */
function voidReasonOf(error: unknown): string | undefined {
  if (error instanceof TrialVoided) return error.reason;
  // A name fallback, as the certification runner's for assertion errors:
  // module duplication (mixed loaders) must not turn a void into a failure.
  if (error instanceof Error && error.name === "TrialVoided") {
    const reason: unknown = (error as { reason?: unknown }).reason;
    if (typeof reason === "string") return reason;
  }
  return undefined;
}

/**
 * Run `trial` (its attempt number, from 1, as its argument) until it
 * reaches a verdict: its value, or any failure but a void, which propagates
 * as is and is never retried. A void (`TrialVoided`) reruns it — the trial
 * builds its own fresh state on every attempt — up to `attempts` attempts in
 * all (default 5); exhaustion is `VoidedTrialsExhaustedError` (H-11).
 */
export async function runVoidableTrial<T>(
  label: string,
  trial: (attempt: number) => Promise<T>,
  options: { readonly attempts?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_VOIDABLE_ATTEMPTS;
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error(
      `runVoidableTrial(${label}): attempts must be a positive integer, got ` +
        `${String(attempts)}`,
    );
  }
  const reasons: string[] = [];
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await trial(attempt);
    } catch (error) {
      const reason = voidReasonOf(error);
      if (reason === undefined) throw error;
      reasons.push(reason);
    }
  }
  throw new VoidedTrialsExhaustedError(label, reasons);
}

/**
 * T13.5-3's reuse check, for a later command refused `workspace-busy` after
 * the harness killed mutating runs under the discipline above: should any of
 * the killed groups' identifiers (`killed`, as `killGroup` returned them) be
 * listed again in the process list — reused since — the trial is void
 * (`TrialVoided`; E-5); none listed, the test fails, diagnosed
 * (`HarnessAssertionError`): a dead run's leftover blocked a later command
 * outside 13.5's gap. `refusal` describes the refused command (its command
 * line and outcome) for either diagnosis. Never returns.
 */
export async function applyReuseCheck(
  killed: Iterable<number>,
  refusal: string,
): Promise<never> {
  const identifiers = ascending(new Set(killed));
  const listedAgain = await listedAmong(identifiers);
  if (listedAgain.length > 0) {
    voidTrial(
      `T13.5-3's reuse check: identifier(s) ${listedAgain.join(", ")} of ` +
        `the killed group(s) are listed again in the process list (reused), ` +
        `so the workspace-busy refusal may be 13.5's gap — the trial is ` +
        `void, rerun on a fresh workspace: ${refusal}`,
    );
  }
  throw new HarnessAssertionError(
    `${refusal}: refused workspace-busy (14.26), yet no identifier of the ` +
      `killed group(s) — ${identifiers.join(", ") || "none recorded"} — is ` +
      `listed in the process list: a dead run's leftover blocked a later ` +
      `mutating command, which SPEC 13.5 forbids outside its gap ` +
      `(TEST-SPEC T13.5-3's reuse check)`,
  );
}
