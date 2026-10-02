// The staged-source ledger's TypeScript records (TEST-SPEC 17 S-9's
// TypeScript clause and its timing clause, H-8) — the sibling of
// helpers/staged-mdx.ts for code sources and configuration files. Every code
// source and configuration file the document declares well-formed (or
// unparseable, 14.20) is a deterministic fixture file S-9's TypeScript check
// must judge before any product exists: accepted by TypeScript 5.9.3 both as
// module code and as script code, or rejected both ways. The builder judges
// every such staging as it is written (helpers/workspace.ts `checkTs`), but
// a staging a registered body makes after its first product invocation — a
// reconfiguration after a `build`, an arm's variant code source, the
// `xspec.config.ts` of a workspace the body creates after that invocation —
// is first reached at suite time, against a real product: S-7's sweep
// against the empty stub fails the body at that invocation and never gets
// there. These records close the gap exactly as the MDX ledger does:
//
// - A registry module creates each such file's contents at module load as a
//   record (`stagedTs`) carrying its bytes, its S-9 declaration, and the
//   grammar it is judged under — the same expression the staging used,
//   moved to module level, never re-spelled, so the staged bytes are
//   identical.
// - The body passes the record to `TestWorkspace.file()`, or as an initial
//   `files` entry of `TestWorkspace.create()`, which stages the record's
//   bytes under the record's declaration (a `ts` option beside the record,
//   or a workspace `ts` declaration naming its path, is a contradiction and
//   throws, as is a record whose grammar the path does not select).
// - The self-test test/self/s9-staged-sources.test.ts loads the whole
//   registry and judges every record against its declaration with the
//   builder's own judge (`judgeTsDeclaration`, one code path) — before any
//   product exists.
//
// The grammar: SPEC 14.20 selects TSX for a file name ending `.tsx` and
// plain TypeScript for any other, and the record is judged before it has a
// path, so it names its grammar itself (`"ts"`, the default, or `"tsx"`),
// and the builder refuses to stage it at a path selecting the other grammar
// — the self-test's verdict and the staging-time verdict are one verdict.
//
// Sealing: the registry manifest (test/suite/registry/index.ts) seals this
// ledger beside the MDX ledger once every registration module has loaded; a
// record created after that — from a test body at run time — would escape
// the self-test, so the registration throws. A record is never `unchecked`
// (that declaration is for a file whose well-formedness the document does
// not declare — P-8's and P-11's mutations, noise files — staged as plain
// contents; a record exists to be judged).
//
// What is NOT a record: a property draw's composed code source or
// configuration (P-7's configurations, P-13's configuration and code
// sources — generated per trial, so no module-level record can hold them;
// staged under the `per-draw` TypeScript declaration, `ts.perDraw` at
// creation or `{ ts: "per-draw" }` per `file()` call, judged well-formed at
// staging, by the section-16 modules alone — S-9's property clause); an
// `unchecked` mutation, noise file, or tampered product-written module; and
// an edit of bytes the product itself wrote (a rename's or move's rewritten
// code source, which no harness constant equals), staged by
// `TestWorkspace.edit()` or carried into a fresh workspace by
// `TestWorkspace.copyFrom()`. The builder's undeclared-staging guard
// (helpers/workspace.ts, its TypeScript arm; helpers/product-invocations.ts)
// refuses every other plain staging of a code source or configuration file
// made after a product invocation — a `file()` write, an initial `files`
// entry of a workspace created after the running body's first invocation,
// a `copyFrom()` out of a workspace no product touched — and an MDX record
// carrying no TypeScript declaration at a path the TypeScript check judges,
// so an omission from the ledger is a harness error at the first run that
// reaches the site.

import type { TsDeclaration } from "./ts-derivability.js";
import type { FileContents } from "./workspace.js";

/**
 * The grammar SPEC 14.20 selects by file name: `tsx` for a name ending
 * `.tsx`, `ts` (plain TypeScript) for any other.
 */
export type TsGrammar = "ts" | "tsx";

const ledger: StagedTs[] = [];
const names = new Set<string>();
let sealed = false;

/**
 * A staged code source or configuration file with its S-9 declaration: the
 * exact bytes a test body stages after a product invocation, whether the
 * document declares them well-formed (the default) or unparseable (14.20),
 * and the grammar they are judged under. Constructing one registers it in
 * the ledger (use `stagedTs`); records are immutable and uniquely named.
 */
export class StagedTs {
  /** `"<TEST-ID> <what it stages>"` — unique across the TypeScript records. */
  readonly name: string;
  /** The staged bytes, exactly as the builder writes them. */
  readonly source: FileContents;
  /** The S-9 declaration in effect for the staging. */
  readonly ts: TsDeclaration;
  /** The grammar the record is judged under; the staged path must select it. */
  readonly grammar: TsGrammar;

  constructor(
    name: string,
    source: FileContents,
    ts: TsDeclaration = "well-formed",
    grammar: TsGrammar = "ts",
  ) {
    if (sealed) {
      throw new Error(
        `staged-source ledger: the TypeScript record ${JSON.stringify(name)} ` +
          "is created after the ledger was sealed — records are created at " +
          "module load by the registry modules, never at run time, so that " +
          "test/self/s9-staged-sources.test.ts judges every one of them " +
          "before any product exists (S-9, H-8)",
      );
    }
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error(
        "staged-source ledger: a TypeScript record needs a non-empty name " +
          'of the form "<TEST-ID> <what it stages>"',
      );
    }
    if (names.has(name)) {
      throw new Error(
        `staged-source ledger: duplicate TypeScript record name ${JSON.stringify(name)}`,
      );
    }
    if (!(typeof source === "string" || source instanceof Uint8Array)) {
      throw new Error(
        `staged-source ledger: the TypeScript record ${JSON.stringify(name)} ` +
          "needs string or byte contents",
      );
    }
    if (ts !== "well-formed" && ts !== "unparseable") {
      throw new Error(
        `staged-source ledger: the TypeScript record ${JSON.stringify(name)} ` +
          `is declared ${JSON.stringify(ts)} — a record is declared ` +
          '"well-formed" or "unparseable" (14.20); `unchecked` is for a file ' +
          "whose well-formedness the document does not declare (a P-8 or " +
          "P-11 mutation, a noise file), staged as plain contents, and a " +
          "record exists to be judged (S-9)",
      );
    }
    if (grammar !== "ts" && grammar !== "tsx") {
      throw new Error(
        `staged-source ledger: the TypeScript record ${JSON.stringify(name)} ` +
          `names the grammar ${JSON.stringify(grammar)} — "ts" (plain ` +
          'TypeScript, any name but `.tsx`) or "tsx" (SPEC 14.20)',
      );
    }
    this.name = name;
    this.source = source;
    this.ts = ts;
    this.grammar = grammar;
    Object.freeze(this);
    names.add(name);
    ledger.push(this);
  }
}

/**
 * Register a staged code source or configuration file at module load:
 * `source` is the very expression the staging used (moved, never
 * re-spelled), `ts` the declaration in effect for that staging — the former
 * `ts` option, else the workspace declaration's entry for the path, else
 * well-formed — and `grammar` the one the staged path selects (`"tsx"` for a
 * `.tsx` path, else `"ts"`).
 */
export function stagedTs(
  name: string,
  source: FileContents,
  ts: TsDeclaration = "well-formed",
  grammar: TsGrammar = "ts",
): StagedTs {
  return new StagedTs(name, source, ts, grammar);
}

/** Every TypeScript record registered so far, in registration order. */
export function stagedTsLedger(): readonly StagedTs[] {
  return ledger;
}

/**
 * Seal the TypeScript records: called once by the registry manifest after
 * every registration module has loaded. Any later registration throws.
 */
export function sealStagedTsLedger(): void {
  if (sealed) {
    throw new Error("staged-source ledger: TypeScript records sealed twice");
  }
  sealed = true;
  Object.freeze(ledger);
}

/** Whether the TypeScript records are sealed (the manifest has loaded). */
export function isStagedTsLedgerSealed(): boolean {
  return sealed;
}

/**
 * The grammar SPEC 14.20 selects for a file name: `tsx` for a name ending
 * `.tsx` (matched as SPEC spells the suffix), `ts` for any other.
 */
export function tsGrammarOf(name: string): TsGrammar {
  return name.endsWith(".tsx") ? "tsx" : "ts";
}

/**
 * A neutral file name of a grammar, handed to the TypeScript judge in place
 * of a path when a record is judged before it is staged (the judge reads
 * only the name's `.tsx` suffix; helpers/ts-derivability.ts).
 */
export function tsGrammarFileName(grammar: TsGrammar): string {
  return grammar === "tsx" ? "staged-source.tsx" : "staged-source.ts";
}
