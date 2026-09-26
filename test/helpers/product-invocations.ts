// Product-invocation tracking for the workspace builder's undeclared-staging
// guard (TEST-SPEC 17 S-9's timing clause, S-7, §0 H-8; helpers/workspace.ts
// `TestWorkspace.file()`). Harness machinery only: this module never touches
// product code, and nothing here is an assertion about a product.
//
// S-7's sweep against the empty stub reaches a registered body's stagings
// only up to the body's FIRST product invocation — the body fails there — so
// an `.mdx` source a body stages after that invocation is judged first at
// suite time, against a real product, unless it is a staged-source record
// (helpers/staged-mdx.ts) the S-9 self-test judged before any product
// existed. The builder enforces that form: a plain `.mdx` staging after an
// invocation throws `HarnessStagingError` of mode `undeclared-staging`
// unless its declaration exempts it. This module tells the builder when an
// invocation has happened, two ways, both marked by `startProduct`
// (helpers/subprocess.ts — the one subprocess path every invocation takes,
// so the mark cannot be bypassed):
//
// - Per workspace: `TestWorkspace.create` registers the workspace root, and
//   its realpath, while the workspace lives (`dispose` unregisters). An
//   invocation whose working directory is a registered root, or a directory
//   inside one, marks that workspace; the directory and its realpath are
//   both matched, so an invocation through a symbolic link into the
//   workspace (T13.4-6) or under a Windows short name resolves to it.
// - Per body: the two places that run a registered test body — the suite's
//   Vitest wrapper (test/suite/declare.ts) and the certification runner
//   (test/self/certification-runner.ts, which S-7's sweep and certification
//   share) — run it inside `runProductTestBody`, an async-local context that
//   an invocation anywhere marks. This is the reach S-7 actually has: the
//   sweep stops at the body's first invocation in whatever workspace, so a
//   staging into a fresh later-arm workspace the product has not touched is
//   unreached too, and a per-workspace mark alone would miss it. Outside
//   such a context — a self-test, the E-6 fixture of helpers/e6.ts — the
//   per-workspace mark stands alone.
//
// Every subprocess the driver starts counts, whatever its binding: a
// certification fixture, the empty stub, or a compiled consumer program
// (helpers/tooling.ts) — a body reaches none of them against the stub before
// its first product invocation, so a staging after any of them is one the
// sweep never sees.

import { AsyncLocalStorage } from "node:async_hooks";
import * as path from "node:path";

/**
 * A live workspace's mark: whether a product has been invoked in it. Obtain
 * one from `registerWorkspaceRoot`; it is read through `invoked`.
 */
export class WorkspaceInvocationMark {
  /** The registry keys this mark is filed under (root and realpath). */
  readonly keys: readonly string[];
  #invoked = false;

  /** @internal — obtain instances via `registerWorkspaceRoot`. */
  constructor(keys: readonly string[]) {
    this.keys = keys;
  }

  /** Whether a product has been invoked in the workspace since creation. */
  get invoked(): boolean {
    return this.#invoked;
  }

  /** @internal — set by `noteProductInvocation`. */
  note(): void {
    this.#invoked = true;
  }
}

const liveRoots = new Map<string, WorkspaceInvocationMark>();

/**
 * Register a live workspace under its root and the root's realpath (the
 * builder calls this from `TestWorkspace.create`). A stale entry under the
 * same key — a workspace never disposed whose directory was removed by other
 * means and whose name a later `mkdtemp` reused — is simply replaced.
 */
export function registerWorkspaceRoot(
  root: string,
  realRoot: string,
): WorkspaceInvocationMark {
  const keys = [...new Set([path.resolve(root), path.resolve(realRoot)])];
  const mark = new WorkspaceInvocationMark(keys);
  for (const key of keys) {
    liveRoots.set(key, mark);
  }
  return mark;
}

/** Forget a workspace (the builder calls this from `dispose`); idempotent. */
export function unregisterWorkspaceRoot(mark: WorkspaceInvocationMark): void {
  for (const key of mark.keys) {
    if (liveRoots.get(key) === mark) liveRoots.delete(key);
  }
}

interface BodyContext {
  readonly id: string;
  invoked: boolean;
}

const bodyContext = new AsyncLocalStorage<BodyContext>();

/**
 * Run one registered test body inside its own invocation context: an
 * invocation anywhere during the body marks the context, and
 * `productInvokedInBody` answers from it for the rest of the body. `id` is
 * the test's TEST-SPEC ID, named in the guard's diagnosis. A synchronous
 * throw from `body` becomes a rejection, as it would from any async body.
 */
export async function runProductTestBody<T>(
  id: string,
  body: () => Promise<T>,
): Promise<T> {
  return await bodyContext.run({ id, invoked: false }, body);
}

/**
 * The ID of the registered test body running in this async context, if a
 * product has been invoked during it — else `undefined` (no invocation yet,
 * or no body context at all).
 */
export function productInvokedInBody(): string | undefined {
  const context = bodyContext.getStore();
  return context !== undefined && context.invoked ? context.id : undefined;
}

/**
 * Record an invocation about to run with working directory `cwd` (whose
 * realpath is `realCwd`; the caller resolves it, falling back to `cwd`):
 * marks the running body's context, if any, and the live workspace whose
 * root is `cwd`, `realCwd`, or an ancestor of either.
 */
export function noteProductInvocation(cwd: string, realCwd: string): void {
  const context = bodyContext.getStore();
  if (context !== undefined) context.invoked = true;
  for (const start of new Set([path.resolve(cwd), path.resolve(realCwd)])) {
    let dir = start;
    for (;;) {
      const mark = liveRoots.get(dir);
      if (mark !== undefined) {
        mark.note();
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
}
