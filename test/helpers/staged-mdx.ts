// The staged-source ledger (TEST-SPEC 17 S-9, H-8). Every MDX source a
// registered test body stages after a product invocation in its workspace —
// an edit, a replacement, an arm's variant — is a deterministic fixture file
// the document declares well-formed (or unparseable, 14.20), and S-9's
// derivability check must run for it before any product exists. The builder
// judges every `.mdx` staging as it is written (helpers/workspace.ts), but a
// staging a body makes after invoking the product is first reached at suite
// time, against a real product: S-7's sweep against the empty stub fails the
// body at that invocation and never gets there. The ledger closes the gap:
//
// - A registry module creates each such source at module load as a record
//   (`stagedMdx`) carrying its bytes and its S-9 declaration together — the
//   same expression the staging used, moved to module level, never re-spelled,
//   so the staged bytes are identical.
// - The body passes the record to `TestWorkspace.file()`, which stages the
//   record's bytes under the record's declaration (an `mdx` option beside a
//   record is a contradiction and throws).
// - The self-test test/self/s9-staged-sources.test.ts loads the whole
//   registry and judges every record against its declaration with the
//   builder's own judge (`judgeMdxDeclaration`, one code path) — before any
//   product exists.
//
// Sealing: the registry manifest (test/suite/registry/index.ts) seals the
// ledger once every registration module has loaded. A record created after
// that — from a test body at run time — would escape the self-test, so the
// registration throws: a harness defect, never tolerated. A record is
// unforgeable — the class's constructor is the registration — so a record
// `file()` accepts is necessarily one the self-test judged, and a record is
// never `unchecked` (that declaration is P-8's fuzz mutations' alone; a
// record exists to be judged).
//
// The initial files of a workspace declaration are records too, wherever
// S-7's sweep does not reach them: a body's FIRST workspace's initial files
// are reached against the stub and may stay plain contents, but the initial
// `.mdx` files of a workspace the body creates after its first product
// invocation — a later arm's, a helper's twin — are deterministic fixtures
// the sweep never sees, so each is a record passed in the declaration's
// `files` (the record-accepting `InitialFileContents`) and staged by
// `TestWorkspace.create()` under the record's declaration, exactly as
// `file()` stages one (the workspace declaration naming the record's path
// is a contradiction and throws); a plain `.mdx` entry there is refused at
// creation, as a plain `file()` staging after an invocation is.
//
// What is NOT a ledger record: a property draw (judged per draw by the
// property runner, S-9's property clause, and staged under the `per-draw`
// declaration — `file()`'s option, or the workspace declaration's `perDraw`
// list for a draw's initial files — by the section-16 modules alone); a
// P-8 mutation (`unchecked`); and an edit of bytes the product itself
// wrote — a rename's or move's rewritten source, which no harness constant
// equals — which `TestWorkspace.edit()` stages from the workspace's current
// bytes, judged at staging time (not a deterministic fixture: before any
// product exists there is nothing to judge) — as `TestWorkspace.copyFrom()`
// carries another workspace's product-written bytes into a fresh one. The
// builder's undeclared-staging guard (helpers/workspace.ts,
// helpers/product-invocations.ts) refuses every other plain `.mdx` staging
// made after a product invocation — a `file()` write, and an initial
// `files` entry of a workspace created after the running body's first
// invocation alike — so an omission from the ledger is a harness error at
// the first run that reaches the site.
//
// Code sources and configuration files have sibling records of their own
// (helpers/staged-ts.ts), sealed by the manifest beside this ledger and
// judged by the same self-test with S-9's TypeScript check. An `.mdx` path a
// code group discovers is an MDX source and a code source at once, so its
// record here carries its TypeScript declaration too (`ts`): the self-test
// judges those bytes as plain TypeScript as well, and the builder stages
// them under both declarations. After a product invocation, a record
// carrying no `ts` at a path the TypeScript check judges is refused by the
// undeclared-staging guard's TypeScript arm: its TypeScript reading was
// never judged before any product existed.

import { MDX_ALLOWANCES } from "./mdx-derivability.js";
import type { TsDeclaration } from "./ts-derivability.js";
import type { FileContents, MdxFileDeclaration } from "./workspace.js";

const ledger: StagedMdx[] = [];
const names = new Set<string>();
let sealed = false;

/**
 * The declarations a record may carry: never `unchecked` (a record exists
 * to be judged), never `per-draw` (a property draw's alone, judged per draw
 * by the property runner).
 */
export type RecordDeclaration = Exclude<
  MdxFileDeclaration,
  "unchecked" | "per-draw"
>;

/**
 * A staged MDX source with its S-9 declaration: the exact bytes a test body
 * stages after a product invocation, and whether the document declares them
 * well-formed (the default), unparseable (14.20), or well-formed under named
 * early-error allowances. Constructing one registers it in the ledger (use
 * `stagedMdx`); records are immutable and uniquely named.
 */
export class StagedMdx {
  /** `"<TEST-ID> <what it stages>"` — unique across the registry. */
  readonly name: string;
  /** The staged bytes, exactly as `TestWorkspace.file()` writes them. */
  readonly source: FileContents;
  /** The S-9 declaration in effect for the staging. */
  readonly mdx: RecordDeclaration;
  /**
   * The S-9 TypeScript declaration of the same bytes, when the staged
   * `.mdx` path is also a code source — a code group globbing `.mdx` names
   * discovers it (SPEC 7.2; T2.1-2's `docs/EXTRA.mdx`) — judged as plain
   * TypeScript too (an `.mdx` name selects plain TypeScript, 14.20); the
   * record then carries the path's TypeScript declaration as well, in place
   * of the workspace declaration's `ts` entry. Undefined for every other
   * record: the path is no code source, and S-9's TypeScript check does not
   * judge it.
   */
  readonly ts: TsDeclaration | undefined;

  constructor(
    name: string,
    source: FileContents,
    mdx: MdxFileDeclaration = "well-formed",
    ts?: TsDeclaration,
  ) {
    if (sealed) {
      throw new Error(
        `staged-source ledger: the record ${JSON.stringify(name)} is created ` +
          "after the ledger was sealed — records are created at module " +
          "load by the registry modules, never at run time, so that " +
          "test/self/s9-staged-sources.test.ts judges every one of them " +
          "before any product exists (S-9, H-8)",
      );
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error(
        "staged-source ledger: a record needs a non-empty name of the form " +
          '"<TEST-ID> <what it stages>"',
      );
    }
    if (names.has(name)) {
      throw new Error(
        `staged-source ledger: duplicate record name ${JSON.stringify(name)}`,
      );
    }
    if (!(typeof source === "string" || source instanceof Uint8Array)) {
      throw new Error(
        `staged-source ledger: the record ${JSON.stringify(name)} needs ` +
          "string or byte contents",
      );
    }
    if (ts !== undefined && ts !== "well-formed" && ts !== "unparseable") {
      throw new Error(
        `staged-source ledger: the record ${JSON.stringify(name)} carries ` +
          `the TypeScript declaration ${JSON.stringify(ts)} — a record's ` +
          'TypeScript declaration is "well-formed" or "unparseable" (14.20), ' +
          "or absent for a path no code group discovers; a record exists to " +
          "be judged (S-9)",
      );
    }
    this.name = name;
    this.source = source;
    this.mdx = validateDeclaration(name, mdx);
    this.ts = ts;
    Object.freeze(this);
    names.add(name);
    ledger.push(this);
  }
}

/**
 * Register a staged MDX source in the ledger at module load: `source` is the
 * very expression the staging used (moved, never re-spelled), `mdx` the
 * declaration in effect for that staging — the former `mdx` option, else the
 * workspace declaration's entry for the path, else well-formed — and `ts`,
 * for a path a code group also discovers as a code source, the TypeScript
 * declaration in effect for it (the former `ts` option, else the workspace
 * declaration's `ts` entry).
 */
export function stagedMdx(
  name: string,
  source: FileContents,
  mdx: MdxFileDeclaration = "well-formed",
  ts?: TsDeclaration,
): StagedMdx {
  return new StagedMdx(name, source, mdx, ts);
}

/** Every record registered so far, in registration order. */
export function stagedMdxLedger(): readonly StagedMdx[] {
  return ledger;
}

/**
 * Seal the ledger: called once by the registry manifest after every
 * registration module has loaded. Any later registration throws.
 */
export function sealStagedMdxLedger(): void {
  if (sealed) {
    throw new Error("staged-source ledger: sealed twice");
  }
  sealed = true;
  Object.freeze(ledger);
}

/** Whether the ledger is sealed (the registry manifest has loaded). */
export function isStagedMdxLedgerSealed(): boolean {
  return sealed;
}

function validateDeclaration(
  name: string,
  mdx: MdxFileDeclaration,
): RecordDeclaration {
  if (mdx === "well-formed" || mdx === "unparseable") return mdx;
  if (mdx === "per-draw") {
    throw new Error(
      `staged-source ledger: the record ${JSON.stringify(name)} is declared ` +
        "`per-draw` — that declaration is a property draw's alone (judged " +
        "per draw by the property runner, section-16 modules); a record is " +
        "a deterministic fixture, judged by the self-test before any " +
        "product exists (S-9), so declare it well-formed, unparseable, or " +
        "under named allowances",
    );
  }
  if (mdx === "unchecked") {
    throw new Error(
      `staged-source ledger: the record ${JSON.stringify(name)} is declared ` +
        "`unchecked` — a record exists to be judged; `unchecked` is for a " +
        "source whose derivability the document does not declare (a P-8 " +
        "mutation), staged as plain contents (S-9)",
    );
  }
  if (
    typeof mdx === "object" &&
    mdx !== null &&
    Array.isArray(mdx.allowances) &&
    mdx.allowances.length > 0 &&
    mdx.allowances.every((allowance) =>
      (MDX_ALLOWANCES as readonly string[]).includes(allowance),
    )
  ) {
    return { allowances: [...mdx.allowances] };
  }
  throw new Error(
    `staged-source ledger: the record ${JSON.stringify(name)} carries an ` +
      `invalid declaration ${JSON.stringify(mdx)} — "well-formed", ` +
      `"unparseable", or { allowances: [...] } naming allowances among ` +
      JSON.stringify(MDX_ALLOWANCES),
  );
}
