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
// What is NOT a ledger record: the initial files of a workspace declaration
// (S-7's sweep reaches them against the stub); a property draw (judged per
// draw by the property runner, S-9's property clause); a P-8 mutation
// (`unchecked`); and an edit of bytes the product itself wrote — a rename's
// or move's rewritten source, which no harness constant equals — which
// `TestWorkspace.edit()` stages from the workspace's current bytes, judged at
// staging time (not a deterministic fixture: before any product exists there
// is nothing to judge).

import { MDX_ALLOWANCES } from "./mdx-derivability.js";
import type { FileContents, MdxFileDeclaration } from "./workspace.js";

const ledger: StagedMdx[] = [];
const names = new Set<string>();
let sealed = false;

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
  readonly mdx: Exclude<MdxFileDeclaration, "unchecked">;

  constructor(
    name: string,
    source: FileContents,
    mdx: MdxFileDeclaration = "well-formed",
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
    this.name = name;
    this.source = source;
    this.mdx = validateDeclaration(name, mdx);
    Object.freeze(this);
    names.add(name);
    ledger.push(this);
  }
}

/**
 * Register a staged MDX source in the ledger at module load: `source` is the
 * very expression the staging used (moved, never re-spelled), `mdx` the
 * declaration in effect for that staging — the former `mdx` option, else the
 * workspace declaration's entry for the path, else well-formed.
 */
export function stagedMdx(
  name: string,
  source: FileContents,
  mdx: MdxFileDeclaration = "well-formed",
): StagedMdx {
  return new StagedMdx(name, source, mdx);
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
): Exclude<MdxFileDeclaration, "unchecked"> {
  if (mdx === "well-formed" || mdx === "unparseable") return mdx;
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
