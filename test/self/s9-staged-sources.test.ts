// Self-test of the staged-source ledger (test/helpers/staged-mdx.ts;
// TEST-SPEC 17 S-9, H-8). Every MDX source a registered test body stages
// after a product invocation in its workspace — an edit, a replacement, an
// arm's variant — is a deterministic fixture file whose well-formedness the
// document declares, and S-9's check runs for it before any product exists.
// S-7's sweep against the empty stub reaches a test's initial staging and the
// `file()` calls before its first invocation only — the body fails at that
// invocation — so a post-invocation staging used to be judged first at suite
// time, against a real product. The ledger closes that gap: each such source
// is a record created at module load (the very expression the staging used,
// moved, never re-spelled) carrying its bytes and its S-9 declaration;
// `TestWorkspace.file()` stages the record; and this file, which loads the
// whole registry (so the ledger is complete and sealed), judges every record
// against its declaration with the builder's own judge (`judgeMdxDeclaration`
// — the one code path `file()` applies at staging time). A record
// contradicting its declaration fails here, before any product exists, as a
// `HarnessStagingError` (mode `mdx-derivability`) — never a product failure,
// never a skip.
//
// Also verified: the ledger's invariants (sealed once the registry has
// loaded, so a run-time registration throws; non-empty; uniquely named, each
// name led by the ID of a registered test, or by E-6 for the §18 exchange
// fixture's four records — helpers/e6.ts is no registry entry, so this file
// imports it before the manifest seals the ledger; no `unchecked` record —
// that declaration is P-8's mutations' alone), its registration rules on a fresh
// unsealed instance, the builder's record overload (a record stages exactly
// its bytes under its own declaration, which overrides the workspace's for
// the path; an `mdx` option beside it, or a non-`.mdx` path, throws with
// nothing written), the record-accepting initial `files` of a workspace
// declaration (`InitialFileContents` — the form of a later-arm workspace's
// initial `.mdx` files, which S-7's sweep never reaches: `create()` stages
// a record under the record's declaration; a record at a non-`.mdx` key, or
// beside a workspace-declaration entry naming its path, throws; the
// declaration's `perDraw` list judges a draw's initial file as well-formed
// and declares the path `per-draw`; `mdxPathsOf` lists a rendered map's
// plain `.mdx` keys for such a list, records left out), the builder's
// `edit()` (a rewrite of the current bytes, judged under the path's
// declaration), and the judge's own red checks (an ill-formed source
// declared well-formed and a deriving source declared unparseable both
// throw; `unchecked` judges nothing).
//
// The ledger's TypeScript records (helpers/staged-ts.ts; S-9's TypeScript
// clause) are verified the same way: every code source and configuration
// file a body stages after its first product invocation is a `StagedTs`
// record created at module load — its bytes, its declaration (well-formed
// or unparseable, never `unchecked`), and the grammar it is judged under
// (`ts`, or `tsx` for a `.tsx` path; SPEC 14.20) — and this file judges
// every one with the builder's own TypeScript judge (`judgeTsDeclaration`,
// handed a neutral file name of the record's grammar) before any product
// exists. Also verified: the records' invariants once the registry has
// loaded (sealed, non-empty, uniquely named after registered tests or E-6;
// the Windows leg's drive-mismatch arm's configuration and spec source,
// helpers/e6-drive-mismatch.ts — staged at creation outside every
// registered body and S-7's sweep — imported before the seal like E-6's),
// their registration rules on a fresh instance, and the builder's record
// overload — `file()` and `create()`'s initial `files` stage a record's
// bytes under the record's declaration, whatever the path's name or
// workspace declaration (a `ts` option beside it, a workspace `ts` entry
// beside an initial record, a path selecting the other grammar, and an
// `.mdx` path all throw, nothing written); a contradicting record throws
// at staging exactly as here.

import { Buffer } from "node:buffer";
import { describe, expect, onTestFinished, test, vi } from "vitest";
import { HarnessAssertionError } from "../helpers/assertions.js";
import type { MdxAllowance } from "../helpers/mdx-derivability.js";
import { HarnessStagingError } from "../helpers/permissions.js";
import {
  StagedMdx,
  isStagedMdxLedgerSealed,
  stagedMdx,
  stagedMdxLedger,
} from "../helpers/staged-mdx.js";
import {
  StagedTs,
  isStagedTsLedgerSealed,
  stagedTs,
  stagedTsLedger,
  tsGrammarFileName,
} from "../helpers/staged-ts.js";
import {
  TestWorkspace,
  judgeMdxDeclaration,
  judgeTsDeclaration,
  mdxPathsOf,
} from "../helpers/workspace.js";
import type { WorkspaceDecl, WorkspaceMdxDecl } from "../helpers/workspace.js";
// The E-6 exchange fixture (helpers/e6.ts) is no registry entry, yet stages
// four `.mdx` sources no sweep reaches — three initial files, and one edit
// after its first invocations — as records of its own, which this import
// registers BEFORE the registry manifest below seals the ledger.
import "../helpers/e6.js";
// Likewise the Windows leg's drive-mismatch arm of T11.6-1
// (test/windows/e6-drive-mismatch.test.ts): it stages its configuration and
// spec source at creation, outside every registered body and S-7's sweep,
// as records of helpers/e6-drive-mismatch.ts, registered here before the
// seal and judged below.
import {
  ANCHOR_CONFIG as DRIVE_MISMATCH_CONFIG,
  ANCHOR_SOURCE as DRIVE_MISMATCH_SOURCE,
} from "../helpers/e6-drive-mismatch.js";
import { productTestSuite } from "../suite/registry/index.js";

const LF = String.fromCodePoint(0x000a);

/** Lines joined by U+000A, the last one terminated. */
const doc = (...lines: readonly string[]): string => lines.join(LF) + LF;

const utf8 = (text: string): Uint8Array => Buffer.from(text, "utf8");

const bytesOf = (source: string | Uint8Array): Uint8Array =>
  typeof source === "string" ? utf8(source) : source;

const text = (data: Uint8Array): string => Buffer.from(data).toString("utf8");

/** The complete ledger: every registry module has loaded through the manifest. */
const LEDGER = stagedMdxLedger();

/** TEST-SPEC §18 E-6's ID: the exchange fixture (helpers/e6.ts), no registry entry. */
const E6_FIXTURE_ID = "E-6";

const ILL_FORMED = doc('<S id="x">', "", "never closed");
const WELL_FORMED = doc('<S id="x">', "", "closed below", "", "</S>");
const DUPLICATE_BINDING = doc(
  'import { a } from "./x.xspec"',
  'import { a } from "./y.xspec"',
  "",
  "# Doc",
);

async function stage(decl: WorkspaceDecl = {}): Promise<TestWorkspace> {
  const workspace = await TestWorkspace.create(decl);
  onTestFinished(() => workspace.dispose());
  return workspace;
}

function expectMdxStagingError(
  thrown: unknown,
  key: string,
  ...fragments: readonly string[]
): void {
  expect(thrown).toBeInstanceOf(HarnessStagingError);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as HarnessStagingError;
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("mdx-derivability");
  expect(error.path).toBe(key);
  expect(error.message).toContain(`mdx-derivability staging of ${key}: `);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
}

async function expectStagingRejected(
  action: () => Promise<unknown>,
  key: string,
  ...fragments: readonly string[]
): Promise<void> {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  expectMdxStagingError(thrown, key, ...fragments);
}

function expectJudgeRejects(
  action: () => void,
  key: string,
  ...fragments: readonly string[]
): void {
  let thrown: unknown;
  try {
    action();
  } catch (error) {
    thrown = error;
  }
  expectMdxStagingError(thrown, key, ...fragments);
}

/** A well-formed record of the registry's own, for the builder checks. */
function someWellFormedRecord(): StagedMdx {
  const record = LEDGER.find((entry) => entry.mdx === "well-formed");
  if (record === undefined) {
    throw new Error("the ledger holds no well-formed record");
  }
  return record;
}

/** A record of the registry's own declared unparseable, for the builder checks. */
function someUnparseableRecord(): StagedMdx {
  const record = LEDGER.find((entry) => entry.mdx === "unparseable");
  if (record === undefined) {
    throw new Error("the ledger holds no unparseable record");
  }
  return record;
}

/**
 * `TestWorkspace.create(decl)` must be refused with an S-9 staging error
 * naming `key`; a workspace it unexpectedly yields is disposed.
 */
async function createRejected(
  decl: WorkspaceDecl,
  key: string,
  ...fragments: readonly string[]
): Promise<void> {
  await expectStagingRejected(
    async () => {
      const workspace = await TestWorkspace.create(decl);
      onTestFinished(() => workspace.dispose());
    },
    key,
    ...fragments,
  );
}

/**
 * A fresh, unsealed ledger and the builder bound to it — both modules
 * re-evaluated after `vi.resetModules()`, so the fresh builder's `StagedMdx`
 * is the fresh ledger's class — for the checks that need a record
 * contradicting its declaration: the sealed registry ledger holds none,
 * this file having judged every record. The fresh builder's errors are the
 * fresh permissions module's, matched by name and mode, not `instanceof`.
 */
async function freshBuilder(): Promise<{
  readonly ledger: typeof import("../helpers/staged-mdx.js");
  readonly builder: typeof import("../helpers/workspace.js");
}> {
  vi.resetModules();
  const ledger = await import("../helpers/staged-mdx.js");
  const builder = await import("../helpers/workspace.js");
  return { ledger, builder };
}

function expectFreshStagingError(
  thrown: unknown,
  key: string,
  ...fragments: readonly string[]
): void {
  expect(thrown).toBeInstanceOf(Error);
  const error = thrown as Error & { mode?: unknown; path?: unknown };
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("mdx-derivability");
  expect(error.path).toBe(key);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
}

// ---------------------------------------------------------------------------
// The ledger's invariants, with the whole registry loaded.

describe("S-9: the staged-source ledger, once the registry has loaded", () => {
  test("is sealed, so a record created at run time throws instead of escaping this self-test", () => {
    expect(isStagedMdxLedgerSealed()).toBe(true);
    expect(() => stagedMdx("T0-0 late record", doc("# Late"))).toThrow(
      /sealed/,
    );
    expect(() => new StagedMdx("T0-0 late record", doc("# Late"))).toThrow(
      /sealed/,
    );
    expect(LEDGER.some((record) => record.name === "T0-0 late record")).toBe(
      false,
    );
  });

  test("is non-empty, and every record is an immutable, uniquely named `StagedMdx`", () => {
    expect(LEDGER.length).toBeGreaterThan(0);
    const names = LEDGER.map((record) => record.name);
    expect(new Set(names).size).toBe(names.length);
    for (const record of LEDGER) {
      expect(record).toBeInstanceOf(StagedMdx);
      expect(Object.isFrozen(record)).toBe(true);
      expect(record.name.trim().length).toBeGreaterThan(0);
      expect(
        typeof record.source === "string" ||
          record.source instanceof Uint8Array,
      ).toBe(true);
    }
  });

  test("names every record after registered tests: `<TEST-ID>[/<TEST-ID>…] <what it stages>` — or after E-6, the §18 exchange fixture's ID (helpers/e6.ts), for its four records", () => {
    let e6Records = 0;
    for (const record of LEDGER) {
      const [lead, ...rest] = record.name.split(" ");
      expect(rest.join(" ").trim(), record.name).not.toBe("");
      for (const id of (lead ?? "").split("/")) {
        if (id === E6_FIXTURE_ID) {
          e6Records += 1;
          continue;
        }
        expect(
          productTestSuite.has(id),
          `${record.name}: ${id} names no registered test (nor ${E6_FIXTURE_ID}, the exchange fixture of helpers/e6.ts)`,
        ).toBe(true);
      }
    }
    // The fixture's records — its three initial `.mdx` sources and its leaf
    // edit — are judged here like every other: its module loaded before the
    // seal (the import order above).
    expect(e6Records).toBe(4);
  });

  test("holds no `unchecked` record (that declaration is P-8's mutations' alone, S-9)", () => {
    for (const record of LEDGER) {
      expect(record.mdx, record.name).not.toBe("unchecked");
    }
  });
});

// ---------------------------------------------------------------------------
// The check S-9 requires before any product exists: every record matches its
// declaration under the builder's own judge.

describe("S-9: every staged source in the ledger matches its declaration before any product exists", () => {
  test.each(LEDGER.map((record) => [record.name, record] as const))(
    "%s",
    (_name, record) => {
      judgeMdxDeclaration(record.name, bytesOf(record.source), record.mdx);
    },
  );
});

// ---------------------------------------------------------------------------
// The registration rules, on a fresh, unsealed instance of the module.

describe("S-9: the ledger's registration rules", () => {
  async function freshLedger(): Promise<
    typeof import("../helpers/staged-mdx.js")
  > {
    vi.resetModules();
    return await import("../helpers/staged-mdx.js");
  }

  test("a record registers in order with its declaration, well-formed by default; a duplicate name throws", async () => {
    const ledger = await freshLedger();
    expect(ledger.isStagedMdxLedgerSealed()).toBe(false);
    expect(ledger.stagedMdxLedger()).toEqual([]);
    const a = ledger.stagedMdx("T0-1 a", WELL_FORMED);
    const b = ledger.stagedMdx("T0-1 b", utf8(ILL_FORMED), "unparseable");
    const c = ledger.stagedMdx("T0-1 c", DUPLICATE_BINDING, {
      allowances: ["duplicate-import-binding"],
    });
    expect(a.mdx).toBe("well-formed");
    expect(a.source).toBe(WELL_FORMED);
    expect(b.mdx).toBe("unparseable");
    expect(c.mdx).toEqual({ allowances: ["duplicate-import-binding"] });
    expect(ledger.stagedMdxLedger()).toEqual([a, b, c]);
    expect(() => ledger.stagedMdx("T0-1 a", WELL_FORMED)).toThrow(/duplicate/);
    expect(ledger.stagedMdxLedger()).toHaveLength(3);
  });

  test("an `unchecked` declaration, an empty name, an unknown allowance, an empty allowance list, and non-file contents are refused", async () => {
    const ledger = await freshLedger();
    expect(() => ledger.stagedMdx("T0-2 u", WELL_FORMED, "unchecked")).toThrow(
      /unchecked/,
    );
    expect(() => ledger.stagedMdx("  ", WELL_FORMED)).toThrow(/non-empty name/);
    expect(() =>
      ledger.stagedMdx("T0-2 n", WELL_FORMED, {
        allowances: ["nope" as MdxAllowance],
      }),
    ).toThrow(/invalid declaration/);
    expect(() =>
      ledger.stagedMdx("T0-2 e", WELL_FORMED, { allowances: [] }),
    ).toThrow(/invalid declaration/);
    expect(() =>
      ledger.stagedMdx("T0-2 c", { text: WELL_FORMED } as unknown as string),
    ).toThrow(/string or byte contents/);
    expect(ledger.stagedMdxLedger()).toEqual([]);
  });

  test("sealing freezes the ledger: a later registration throws, and sealing twice throws", async () => {
    const ledger = await freshLedger();
    const a = ledger.stagedMdx("T0-3 a", WELL_FORMED);
    ledger.sealStagedMdxLedger();
    expect(ledger.isStagedMdxLedgerSealed()).toBe(true);
    expect(() => ledger.stagedMdx("T0-3 b", WELL_FORMED)).toThrow(/sealed/);
    expect(() => ledger.sealStagedMdxLedger()).toThrow(/sealed twice/);
    expect(ledger.stagedMdxLedger()).toEqual([a]);
    expect(Object.isFrozen(ledger.stagedMdxLedger())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The builder's record overload (helpers/workspace.ts `file()`).

describe("S-9: the builder stages a record's bytes under the record's declaration", () => {
  test("a record stages exactly its bytes", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage();
    await workspace.file("specs/record.mdx", record);
    expect(
      Buffer.compare(
        Buffer.from(await workspace.readBytes("specs/record.mdx")),
        Buffer.from(bytesOf(record.source)),
      ),
    ).toBe(0);
  });

  test("a record's declaration overrides the workspace declaration for its path, as the `mdx` option does; plain contents there are judged under the workspace's", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage({
      mdx: { unparseable: ["specs/record.mdx"] },
    });
    await workspace.file("specs/record.mdx", record);
    expect(await workspace.kind("specs/record.mdx")).toBe("file");
    await expectStagingRejected(
      () => workspace.file("specs/record.mdx", record.source),
      "specs/record.mdx",
      "declared unparseable (`mdx.unparseable`) but the source derives",
    );
  });

  test("an `mdx` option beside a record is a contradiction: nothing is written", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage();
    await expectStagingRejected(
      () => workspace.file("specs/record.mdx", record, { mdx: "well-formed" }),
      "specs/record.mdx",
      "contradiction",
      JSON.stringify(record.name),
    );
    expect(await workspace.kind("specs/record.mdx")).toBe("absent");
  });

  test("a record at a path S-9 does not judge is a mistake: nothing is written", async () => {
    const record = someWellFormedRecord();
    const workspace = await stage();
    await expectStagingRejected(
      () => workspace.file("src/record.ts", record),
      "src/record.ts",
      "not an `.mdx` path",
      JSON.stringify(record.name),
    );
    expect(await workspace.kind("src/record.ts")).toBe("absent");
  });

  test("a record is judged at staging time too (the same judge): a fresh ledger's contradicting record throws", async () => {
    vi.resetModules();
    const ledger = await import("../helpers/staged-mdx.js");
    // The fresh module instance's class is not the builder's, so the record
    // is staged through the judge the builder applies to plain contents
    // under the record's own declaration — the code path `file()` takes.
    const record = ledger.stagedMdx("T0-4 ill-formed", ILL_FORMED);
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(record.name, bytesOf(record.source), record.mdx),
      record.name,
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
  });
});

// ---------------------------------------------------------------------------
// The record-accepting initial `files` (`InitialFileContents`): the form of a
// later-arm workspace's initial `.mdx` files — a workspace the body creates
// after its first product invocation, which S-7's sweep never reaches — so
// `create()` stages a record under the record's declaration as `file()`
// does. A refusal is `create()`'s: the workspace is disposed, nothing left.

describe("S-9: the builder stages an initial `files` record under the record's declaration", () => {
  test("a record in `files` stages exactly its bytes, under its own declaration: a well-formed record and an unparseable one alike, whatever the workspace's default for the path", async () => {
    const wellFormed = someWellFormedRecord();
    const unparseable = someUnparseableRecord();
    const workspace = await stage({
      files: {
        "specs/record.mdx": wellFormed,
        "specs/unparseable.mdx": unparseable,
        "notes.txt": "plain text\n",
      },
    });
    expect(
      Buffer.compare(
        Buffer.from(await workspace.readBytes("specs/record.mdx")),
        Buffer.from(bytesOf(wellFormed.source)),
      ),
    ).toBe(0);
    expect(
      Buffer.compare(
        Buffer.from(await workspace.readBytes("specs/unparseable.mdx")),
        Buffer.from(bytesOf(unparseable.source)),
      ),
    ).toBe(0);
    expect(text(await workspace.readBytes("notes.txt"))).toBe("plain text\n");
    // The path's workspace declaration is the default (well-formed), under
    // which the unparseable record's bytes are refused as plain contents:
    // the record's own declaration governed the staging.
    expect(workspace.mdxDeclarationOf("specs/unparseable.mdx")).toBe(
      "well-formed",
    );
    await expectStagingRejected(
      () => workspace.file("specs/unparseable.mdx", unparseable.source),
      "specs/unparseable.mdx",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
  });

  test("a record is judged at creation (the same judge): a fresh ledger's contradicting record makes `create()` throw, either way round", async () => {
    const { ledger, builder } = await freshBuilder();
    const deriving = ledger.stagedMdx(
      "T0-5 deriving, declared unparseable",
      WELL_FORMED,
      "unparseable",
    );
    const illFormed = ledger.stagedMdx(
      "T0-5 ill-formed, declared well-formed",
      ILL_FORMED,
    );
    for (const [record, fragment] of [
      [
        deriving,
        "declared unparseable (`mdx.unparseable`) but the source derives",
      ],
      [
        illFormed,
        "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
      ],
    ] as const) {
      let thrown: unknown;
      try {
        const workspace = await builder.TestWorkspace.create({
          files: { "specs/record.mdx": record },
        });
        onTestFinished(() => workspace.dispose());
      } catch (error) {
        thrown = error;
      }
      expectFreshStagingError(thrown, "specs/record.mdx", fragment);
    }
  });

  test("a record at a key S-9 does not judge is a mistake: `create()` throws", async () => {
    const record = someWellFormedRecord();
    await createRejected(
      { files: { "src/record.ts": record } },
      "src/record.ts",
      "not an `.mdx` path",
      JSON.stringify(record.name),
    );
  });

  test("a record beside a workspace declaration naming its path is a contradiction, whichever list names it: `create()` throws", async () => {
    const record = someWellFormedRecord();
    const P = "specs/record.mdx";
    const declarations: readonly WorkspaceMdxDecl[] = [
      { unparseable: [P] },
      { unchecked: [P] },
      { allowances: { [P]: ["duplicate-import-binding"] } },
      { perDraw: [P] },
    ];
    for (const mdx of declarations) {
      await createRejected(
        { files: { [P]: record }, mdx },
        P,
        "contradiction",
        JSON.stringify(record.name),
        "drop the declaration entry",
      );
    }
  });

  test("`perDraw`: a listed path's initial contents are judged well-formed at creation and the path is declared `per-draw`; an ill-formed entry throws; a path in two lists, or not an MDX source, throws", async () => {
    const draw = "specs/draw.mdx";
    const workspace = await stage({
      files: { [draw]: WELL_FORMED },
      mdx: { perDraw: [draw] },
    });
    expect(workspace.mdxDeclarationOf(draw)).toBe("per-draw");
    expect(text(await workspace.readBytes(draw))).toBe(WELL_FORMED);
    await createRejected(
      { files: { [draw]: ILL_FORMED }, mdx: { perDraw: [draw] } },
      draw,
      "declared well-formed per draw",
      "but the stock MDX 3 parser rejects it",
    );
    await createRejected(
      { mdx: { perDraw: [draw], unchecked: [draw] } },
      draw,
      "more than one of",
      "`perDraw`",
    );
    await createRejected(
      { mdx: { perDraw: ["specs/draw.md"] } },
      "specs/draw.md",
      "not an MDX source",
    );
  });

  test("`mdxPathsOf`: the plain `.mdx` keys of an initial `files` map, in map order — a record entry and a non-`.mdx` key left out — so a `perDraw` list derived from a rendered map never names a record's path", async () => {
    const record = someWellFormedRecord();
    const files = {
      "xspec.config.ts": "export default {}",
      "specs/b.mdx": WELL_FORMED,
      "specs/a.mdx": WELL_FORMED,
      "specs/note.md": "# not judged",
      "specs/record.mdx": record,
      "specs/bytes.mdx": Buffer.from(WELL_FORMED, "utf8"),
    };
    expect(mdxPathsOf(files)).toEqual([
      "specs/b.mdx",
      "specs/a.mdx",
      "specs/bytes.mdx",
    ]);
    expect(mdxPathsOf({})).toEqual([]);
    expect(mdxPathsOf({ "specs/record.mdx": record })).toEqual([]);
    const workspace = await stage({
      files,
      mdx: { perDraw: mdxPathsOf(files) },
    });
    for (const rel of ["specs/b.mdx", "specs/a.mdx", "specs/bytes.mdx"]) {
      expect(workspace.mdxDeclarationOf(rel)).toBe("per-draw");
    }
    expect(await workspace.readBytes("specs/record.mdx")).toEqual(
      bytesOf(record.source),
    );
  });
});

// ---------------------------------------------------------------------------
// The builder's `edit()`: a rewrite of the current bytes — the form of an
// edit to bytes the product wrote — judged under the path's declaration.

describe("S-9: the builder's edit() rewrites the current bytes under the path's declaration", () => {
  const BASE = doc('<S id="e">', "", "Alpha text. Alpha text.", "", "</S>");

  test("replaces the first occurrence of `from` and stages the result", async () => {
    const workspace = await stage({ files: { "specs/e.mdx": BASE } });
    await workspace.edit("specs/e.mdx", "Alpha text.", "Alpha text, edited.");
    expect(text(await workspace.readBytes("specs/e.mdx"))).toBe(
      doc('<S id="e">', "", "Alpha text, edited. Alpha text.", "", "</S>"),
    );
  });

  test("a `from` the file does not contain is a harness staging error, the file untouched", async () => {
    const workspace = await stage({ files: { "specs/e.mdx": BASE } });
    await expect(
      workspace.edit("specs/e.mdx", "Beta text.", "Beta text, edited."),
    ).rejects.toThrow(/harness staging: specs\/e\.mdx does not contain/);
    expect(text(await workspace.readBytes("specs/e.mdx"))).toBe(BASE);
  });

  test("an edit breaking well-formedness contradicts the path's declaration (well-formed by default): nothing is written", async () => {
    const workspace = await stage({ files: { "specs/e.mdx": BASE } });
    await expectStagingRejected(
      () => workspace.edit("specs/e.mdx", "</S>", ""),
      "specs/e.mdx",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
    expect(text(await workspace.readBytes("specs/e.mdx"))).toBe(BASE);
  });

  test("a path the workspace declares unparseable judges the edit under that declaration", async () => {
    const workspace = await stage({
      files: { "specs/u.mdx": ILL_FORMED },
      mdx: { unparseable: ["specs/u.mdx"] },
    });
    await workspace.edit("specs/u.mdx", "never closed", "still never closed");
    await expectStagingRejected(
      () => workspace.edit("specs/u.mdx", "still never closed", "closed\n</S>"),
      "specs/u.mdx",
      "declared unparseable (`mdx.unparseable`) but the source derives",
    );
    expect(text(await workspace.readBytes("specs/u.mdx"))).toBe(
      doc('<S id="x">', "", "still never closed"),
    );
  });
});

// ---------------------------------------------------------------------------
// The judge itself (the one code path the builder and this self-test share).

describe("S-9: the judge — an ill-formed source declared well-formed and a deriving source declared unparseable both throw", () => {
  test("an ill-formed source declared well-formed throws mode `mdx-derivability`, naming the key and the parser's rejection", () => {
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(
          "hand-made ill-formed",
          utf8(ILL_FORMED),
          "well-formed",
        ),
      "hand-made ill-formed",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
  });

  test("a deriving source declared unparseable throws", () => {
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(
          "hand-made deriving",
          utf8(WELL_FORMED),
          "unparseable",
        ),
      "hand-made deriving",
      "declared unparseable (`mdx.unparseable`) but the source derives",
    );
  });

  test("a source relying on an early error passes under its named allowance alone", () => {
    judgeMdxDeclaration("allowed", utf8(DUPLICATE_BINDING), {
      allowances: ["duplicate-import-binding"],
    });
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration(
          "not allowed",
          utf8(DUPLICATE_BINDING),
          "well-formed",
        ),
      "not allowed",
      "declared well-formed (S-9's default) but the stock MDX 3 parser rejects it",
    );
    expectJudgeRejects(
      () =>
        judgeMdxDeclaration("unknown allowance", utf8(WELL_FORMED), {
          allowances: ["nope" as MdxAllowance],
        }),
      "unknown allowance",
      "unknown allowance",
    );
  });

  test("a matching declaration passes, and `unchecked` judges nothing", () => {
    judgeMdxDeclaration("well-formed", utf8(WELL_FORMED), "well-formed");
    judgeMdxDeclaration("unparseable", utf8(ILL_FORMED), "unparseable");
    judgeMdxDeclaration("unchecked", utf8(ILL_FORMED), "unchecked");
  });
});

// ---------------------------------------------------------------------------
// The staged-source ledger's TypeScript records (helpers/staged-ts.ts): every
// code source and configuration file a registered body stages after its
// first product invocation — a reconfiguration after a `build`, an arm's
// variant code source, the configuration of a workspace the body creates
// after that invocation — is a record created at module load, judged here
// with the builder's own TypeScript judge (`judgeTsDeclaration`, the one
// code path `checkTs` applies at staging time) under the grammar the record
// names, before any product exists (S-9's TypeScript clause and its timing
// clause, H-8).

/** The complete TypeScript records: every registry module has loaded. */
const TS_LEDGER = stagedTsLedger();

const TS_WELL_FORMED = "export const a = 1;" + LF;
const TS_ILL_FORMED = "export const = 1;" + LF;
/** TSX-only: a JSX element is a syntax error in plain TypeScript. */
const TSX_ONLY = "export const e = <a />;" + LF;
/** Accepted read as module code only (a top-level `await` form, S-9). */
const TS_ONE_WAY = "await /re/;" + LF;

function expectTsStagingError(
  thrown: unknown,
  key: string,
  ...fragments: readonly string[]
): void {
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown).not.toBeInstanceOf(HarnessAssertionError);
  const error = thrown as Error & { mode?: unknown; path?: unknown };
  expect(error.name).toBe("HarnessStagingError");
  expect(error.mode).toBe("ts-derivability");
  expect(error.path).toBe(key);
  expect(error.message).toContain(`ts-derivability staging of ${key}: `);
  for (const fragment of fragments) {
    expect(error.message).toContain(fragment);
  }
}

async function expectTsRejected(
  action: () => Promise<unknown>,
  key: string,
  ...fragments: readonly string[]
): Promise<void> {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  expectTsStagingError(thrown, key, ...fragments);
}

/** A well-formed plain-TypeScript record of the registry's own. */
function someWellFormedTsRecord(): StagedTs {
  const record = TS_LEDGER.find(
    (entry) => entry.ts === "well-formed" && entry.grammar === "ts",
  );
  if (record === undefined) {
    throw new Error("the ledger holds no well-formed TypeScript record");
  }
  return record;
}

/**
 * A fresh, unsealed TypeScript ledger and the builder bound to it (both
 * re-evaluated after `vi.resetModules()`, so the fresh builder's `StagedTs`
 * is the fresh ledger's class): for the records the sealed registry ledger
 * cannot hold — contradicting ones, TSX ones. Errors are the fresh modules'
 * own, matched by name and mode.
 */
async function freshTsBuilder(): Promise<{
  readonly ledger: typeof import("../helpers/staged-ts.js");
  readonly builder: typeof import("../helpers/workspace.js");
}> {
  vi.resetModules();
  const ledger = await import("../helpers/staged-ts.js");
  const builder = await import("../helpers/workspace.js");
  return { ledger, builder };
}

describe("S-9: the staged TypeScript records, once the registry has loaded", () => {
  test("are sealed, so a record created at run time throws instead of escaping this self-test", () => {
    expect(isStagedTsLedgerSealed()).toBe(true);
    expect(() => stagedTs("T0-0 late record", TS_WELL_FORMED)).toThrow(
      /sealed/,
    );
    expect(() => new StagedTs("T0-0 late record", TS_WELL_FORMED)).toThrow(
      /sealed/,
    );
    expect(TS_LEDGER.some((record) => record.name === "T0-0 late record")).toBe(
      false,
    );
  });

  test("are non-empty, and every record is an immutable, uniquely named `StagedTs` declared well-formed or unparseable under a named grammar", () => {
    expect(TS_LEDGER.length).toBeGreaterThan(0);
    const names = TS_LEDGER.map((record) => record.name);
    expect(new Set(names).size).toBe(names.length);
    for (const record of TS_LEDGER) {
      expect(record).toBeInstanceOf(StagedTs);
      expect(Object.isFrozen(record)).toBe(true);
      expect(record.name.trim().length).toBeGreaterThan(0);
      expect(
        typeof record.source === "string" ||
          record.source instanceof Uint8Array,
      ).toBe(true);
      expect(["well-formed", "unparseable"], record.name).toContain(record.ts);
      expect(["ts", "tsx"], record.name).toContain(record.grammar);
    }
  });

  test("names every record after registered tests: `<TEST-ID>[/<TEST-ID>…] <what it stages>` — or after E-6, the §18 exchange fixture's ID (helpers/e6.ts), for its two records", () => {
    let e6Records = 0;
    for (const record of TS_LEDGER) {
      const [lead, ...rest] = record.name.split(" ");
      expect(rest.join(" ").trim(), record.name).not.toBe("");
      for (const id of (lead ?? "").split("/")) {
        if (id === E6_FIXTURE_ID) {
          e6Records += 1;
          continue;
        }
        expect(
          productTestSuite.has(id),
          `${record.name}: ${id} names no registered test (nor ${E6_FIXTURE_ID}, the exchange fixture of helpers/e6.ts)`,
        ).toBe(true);
      }
    }
    // The fixture's configuration and code source, staged at its creation
    // outside every registered body and S-7's sweep, are judged here alone.
    expect(e6Records).toBe(2);
  });

  test("hold the Windows leg's drive-mismatch configuration, and the MDX ledger its spec source (test/windows/e6-drive-mismatch.test.ts stages both at creation, outside every registered body and S-7's sweep): judged here, before any product exists", () => {
    expect(TS_LEDGER).toContain(DRIVE_MISMATCH_CONFIG);
    expect(LEDGER).toContain(DRIVE_MISMATCH_SOURCE);
    expect(DRIVE_MISMATCH_CONFIG.ts).toBe("well-formed");
    expect(DRIVE_MISMATCH_CONFIG.grammar).toBe("ts");
    expect(DRIVE_MISMATCH_SOURCE.mdx).toBe("well-formed");
    expect(DRIVE_MISMATCH_SOURCE.ts).toBeUndefined();
    judgeTsDeclaration(
      DRIVE_MISMATCH_CONFIG.name,
      bytesOf(DRIVE_MISMATCH_CONFIG.source),
      DRIVE_MISMATCH_CONFIG.ts,
      tsGrammarFileName(DRIVE_MISMATCH_CONFIG.grammar),
    );
    judgeMdxDeclaration(
      DRIVE_MISMATCH_SOURCE.name,
      bytesOf(DRIVE_MISMATCH_SOURCE.source),
      DRIVE_MISMATCH_SOURCE.mdx,
    );
  });
});

/**
 * Every TypeScript judgement the ledger declares: each TypeScript record
 * under its grammar, and each MDX record of a code-group `.mdx` path (one
 * carrying `ts`) as plain TypeScript — an `.mdx` name selects it (14.20).
 */
const TS_JUDGEMENTS: readonly (readonly [
  string,
  Uint8Array,
  "well-formed" | "unparseable",
  string,
])[] = [
  ...TS_LEDGER.map(
    (record) =>
      [
        record.name,
        bytesOf(record.source),
        record.ts,
        tsGrammarFileName(record.grammar),
      ] as const,
  ),
  ...LEDGER.flatMap((record) =>
    record.ts === undefined
      ? []
      : [
          [
            `${record.name} (as TypeScript)`,
            bytesOf(record.source),
            record.ts,
            tsGrammarFileName("ts"),
          ] as const,
        ],
  ),
];

describe("S-9: every staged TypeScript source in the ledger matches its declaration before any product exists", () => {
  test.each(TS_JUDGEMENTS)("%s", (name, data, declaration, fileName) => {
    judgeTsDeclaration(name, data, declaration, fileName);
  });
});

describe("S-9: the TypeScript records' registration rules", () => {
  async function freshTsLedger(): Promise<
    typeof import("../helpers/staged-ts.js")
  > {
    vi.resetModules();
    return await import("../helpers/staged-ts.js");
  }

  test("a record registers in order with its declaration and grammar, well-formed plain TypeScript by default; a duplicate name throws", async () => {
    const ledger = await freshTsLedger();
    expect(ledger.isStagedTsLedgerSealed()).toBe(false);
    expect(ledger.stagedTsLedger()).toEqual([]);
    const a = ledger.stagedTs("T0-1 a", TS_WELL_FORMED);
    const b = ledger.stagedTs("T0-1 b", utf8(TS_ILL_FORMED), "unparseable");
    const c = ledger.stagedTs("T0-1 c", TSX_ONLY, "well-formed", "tsx");
    expect([a.ts, a.grammar]).toEqual(["well-formed", "ts"]);
    expect(a.source).toBe(TS_WELL_FORMED);
    expect([b.ts, b.grammar]).toEqual(["unparseable", "ts"]);
    expect([c.ts, c.grammar]).toEqual(["well-formed", "tsx"]);
    expect(ledger.stagedTsLedger()).toEqual([a, b, c]);
    expect(() => ledger.stagedTs("T0-1 a", TS_WELL_FORMED)).toThrow(
      /duplicate/,
    );
    expect(ledger.stagedTsLedger()).toHaveLength(3);
  });

  test("an `unchecked` declaration, an unknown grammar, an empty name, and non-file contents are refused", async () => {
    const ledger = await freshTsLedger();
    expect(() =>
      ledger.stagedTs(
        "T0-2 u",
        TS_WELL_FORMED,
        "unchecked" as unknown as "well-formed",
      ),
    ).toThrow(/unchecked/);
    expect(() =>
      ledger.stagedTs(
        "T0-2 g",
        TS_WELL_FORMED,
        "well-formed",
        "jsx" as unknown as "ts",
      ),
    ).toThrow(/grammar/);
    expect(() => ledger.stagedTs("  ", TS_WELL_FORMED)).toThrow(
      /non-empty name/,
    );
    expect(() =>
      ledger.stagedTs("T0-2 c", { text: TS_WELL_FORMED } as unknown as string),
    ).toThrow(/string or byte contents/);
    expect(ledger.stagedTsLedger()).toEqual([]);
  });

  test("sealing freezes the records: a later registration throws, and sealing twice throws", async () => {
    const ledger = await freshTsLedger();
    const a = ledger.stagedTs("T0-3 a", TS_WELL_FORMED);
    ledger.sealStagedTsLedger();
    expect(ledger.isStagedTsLedgerSealed()).toBe(true);
    expect(() => ledger.stagedTs("T0-3 b", TS_WELL_FORMED)).toThrow(/sealed/);
    expect(() => ledger.sealStagedTsLedger()).toThrow(/sealed twice/);
    expect(ledger.stagedTsLedger()).toEqual([a]);
    expect(Object.isFrozen(ledger.stagedTsLedger())).toBe(true);
  });

  test("the grammar a name selects: `.tsx` alone selects TSX (SPEC 14.20)", async () => {
    const ledger = await freshTsLedger();
    expect(ledger.tsGrammarOf("src/a.tsx")).toBe("tsx");
    for (const name of [
      "src/a.ts",
      "xspec.config.ts",
      "a.d.ts",
      "a.jsx",
      "specs/a.md",
      "a.TSX",
    ]) {
      expect(ledger.tsGrammarOf(name), name).toBe("ts");
    }
    expect(ledger.tsGrammarOf(ledger.tsGrammarFileName("tsx"))).toBe("tsx");
    expect(ledger.tsGrammarOf(ledger.tsGrammarFileName("ts"))).toBe("ts");
  });
});

describe("S-9: the builder stages a TypeScript record's bytes under the record's declaration", () => {
  test("a record stages exactly its bytes, at a configuration path and at a code-source path", async () => {
    const record = someWellFormedTsRecord();
    const workspace = await stage();
    for (const rel of ["xspec.config.ts", "src/record.ts"]) {
      await workspace.file(rel, record);
      expect(
        Buffer.compare(
          Buffer.from(await workspace.readBytes(rel)),
          Buffer.from(bytesOf(record.source)),
        ),
        rel,
      ).toBe(0);
    }
  });

  test("a record's declaration governs its write, overriding the workspace declaration and the name's default, as the `ts` option does — a code source whose name the default does not reach included", async () => {
    const { ledger, builder } = await freshTsBuilder();
    const unparseable = ledger.stagedTs(
      "T0-4 ill-formed",
      TS_ILL_FORMED,
      "unparseable",
    );
    const wellFormed = ledger.stagedTs("T0-4 well-formed", TS_WELL_FORMED);
    const workspace = await builder.TestWorkspace.create({
      ts: { unchecked: ["src/u.ts"], unparseable: ["src/w.ts"] },
    });
    onTestFinished(() => workspace.dispose());
    await workspace.file("src/a.ts", unparseable);
    await workspace.file("src/u.ts", unparseable);
    await workspace.file("src/w.ts", wellFormed);
    await workspace.file("specs/code.md", wellFormed);
    expect(text(await workspace.readBytes("src/a.ts"))).toBe(TS_ILL_FORMED);
    expect(text(await workspace.readBytes("specs/code.md"))).toBe(
      TS_WELL_FORMED,
    );
    // Plain contents there are judged under the path's declaration still.
    await expectTsRejected(
      () => workspace.file("src/a.ts", TS_ILL_FORMED),
      "src/a.ts",
      "declared well-formed",
    );
    await expectTsRejected(
      () => workspace.file("src/w.ts", TS_WELL_FORMED),
      "src/w.ts",
      "declared unparseable",
    );
  });

  test("a `ts` option beside a record is a contradiction: nothing is written", async () => {
    const record = someWellFormedTsRecord();
    const workspace = await stage();
    await expectTsRejected(
      () => workspace.file("src/record.ts", record, { ts: "well-formed" }),
      "src/record.ts",
      "contradiction",
      JSON.stringify(record.name),
    );
    expect(await workspace.kind("src/record.ts")).toBe("absent");
  });

  test("a record staged at a path selecting the other grammar is a mistake, either way round: nothing is written", async () => {
    const record = someWellFormedTsRecord();
    const workspace = await stage();
    await expectTsRejected(
      () => workspace.file("src/record.tsx", record),
      "src/record.tsx",
      JSON.stringify(record.name),
      "grammar",
    );
    expect(await workspace.kind("src/record.tsx")).toBe("absent");
    const { ledger, builder } = await freshTsBuilder();
    const tsx = ledger.stagedTs("T0-5 tsx", TSX_ONLY, "well-formed", "tsx");
    const fresh = await builder.TestWorkspace.create();
    onTestFinished(() => fresh.dispose());
    await fresh.file("src/view.tsx", tsx);
    expect(text(await fresh.readBytes("src/view.tsx"))).toBe(TSX_ONLY);
    await expectTsRejected(
      () => fresh.file("src/view.ts", tsx),
      "src/view.ts",
      '"T0-5 tsx"',
      "grammar",
    );
    expect(await fresh.kind("src/view.ts")).toBe("absent");
  });

  test("a TypeScript record at an `.mdx` path is a mistake: nothing is written", async () => {
    const record = someWellFormedTsRecord();
    const workspace = await stage();
    await expectTsRejected(
      () => workspace.file("docs/code.mdx", record),
      "docs/code.mdx",
      JSON.stringify(record.name),
      "`.mdx` path",
    );
    expect(await workspace.kind("docs/code.mdx")).toBe("absent");
  });

  test("a record is judged at staging time too (the same judge): a fresh ledger's contradicting records throw, one-way text under either declaration included", async () => {
    const { ledger, builder } = await freshTsBuilder();
    const workspace = await builder.TestWorkspace.create();
    onTestFinished(() => workspace.dispose());
    for (const [record, fragment] of [
      [
        ledger.stagedTs("T0-6 ill-formed", TS_ILL_FORMED),
        "declared well-formed",
      ],
      [
        ledger.stagedTs("T0-6 deriving", TS_WELL_FORMED, "unparseable"),
        "declared unparseable",
      ],
      [
        ledger.stagedTs("T0-6 one-way", TS_ONE_WAY),
        "accepted read as module code only",
      ],
      [
        ledger.stagedTs("T0-6 one-way, unparseable", TS_ONE_WAY, "unparseable"),
        "accepted read as module code only",
      ],
      [
        ledger.stagedTs("T0-6 TSX-only as plain", TSX_ONLY),
        "declared well-formed",
      ],
    ] as const) {
      await expectTsRejected(
        () => workspace.file("src/record.ts", record),
        "src/record.ts",
        fragment,
      );
      expect(await workspace.kind("src/record.ts"), record.name).toBe("absent");
      // The self-test's own judgement of the record: the same verdict.
      let thrown: unknown;
      try {
        builder.judgeTsDeclaration(
          record.name,
          bytesOf(record.source),
          record.ts,
          ledger.tsGrammarFileName(record.grammar),
        );
      } catch (error) {
        thrown = error;
      }
      expectTsStagingError(thrown, record.name, fragment);
    }
  });
});

describe("S-9: the builder stages an initial `files` TypeScript record under the record's declaration", () => {
  test("a record in `files` stages exactly its bytes under its own declaration, whatever the name's default", async () => {
    const { ledger, builder } = await freshTsBuilder();
    const config = ledger.stagedTs("T0-7 configuration", TS_WELL_FORMED);
    const unparseable = ledger.stagedTs(
      "T0-7 ill-formed",
      TS_ILL_FORMED,
      "unparseable",
    );
    const view = ledger.stagedTs("T0-7 view", TSX_ONLY, "well-formed", "tsx");
    const workspace = await builder.TestWorkspace.create({
      files: {
        "xspec.config.ts": config,
        "src/bad.ts": unparseable,
        "src/view.tsx": view,
        "specs/code.md": config,
        "notes.txt": "plain text\n",
      },
    });
    onTestFinished(() => workspace.dispose());
    expect(text(await workspace.readBytes("xspec.config.ts"))).toBe(
      TS_WELL_FORMED,
    );
    expect(text(await workspace.readBytes("src/bad.ts"))).toBe(TS_ILL_FORMED);
    expect(text(await workspace.readBytes("src/view.tsx"))).toBe(TSX_ONLY);
    expect(text(await workspace.readBytes("specs/code.md"))).toBe(
      TS_WELL_FORMED,
    );
    // The path's own declaration stayed the name's default.
    expect(workspace.tsDeclarationOf("src/bad.ts")).toBe("well-formed");
    expect(workspace.tsDeclarationOf("specs/code.md")).toBeUndefined();
  });

  test("a record contradicting its declaration, at a path of the other grammar, at an `.mdx` key, or beside a workspace `ts` entry naming its path, makes `create()` throw", async () => {
    const { ledger, builder } = await freshTsBuilder();
    const wellFormed = ledger.stagedTs("T0-8 well-formed", TS_WELL_FORMED);
    const illFormed = ledger.stagedTs("T0-8 ill-formed", TS_ILL_FORMED);
    const cases: readonly (readonly [
      WorkspaceDecl,
      string,
      readonly string[],
    ])[] = [
      [
        { files: { "src/a.ts": illFormed } },
        "src/a.ts",
        ["declared well-formed"],
      ],
      [{ files: { "src/a.tsx": wellFormed } }, "src/a.tsx", ["grammar"]],
      [{ files: { "docs/a.mdx": wellFormed } }, "docs/a.mdx", ["`.mdx` path"]],
      [
        {
          files: { "src/a.ts": wellFormed },
          ts: { unparseable: ["src/a.ts"] },
        },
        "src/a.ts",
        ["contradiction", "drop the declaration entry"],
      ],
      [
        { files: { "src/a.ts": wellFormed }, ts: { unchecked: ["src/a.ts"] } },
        "src/a.ts",
        ["contradiction"],
      ],
      [
        {
          files: { "specs/a.md": wellFormed },
          ts: { wellFormed: ["specs/a.md"] },
        },
        "specs/a.md",
        ["contradiction"],
      ],
    ];
    for (const [decl, key, fragments] of cases) {
      let thrown: unknown;
      try {
        const workspace = await builder.TestWorkspace.create(
          decl as Parameters<typeof builder.TestWorkspace.create>[0],
        );
        onTestFinished(() => workspace.dispose());
      } catch (error) {
        thrown = error;
      }
      expectTsStagingError(thrown, key, ...fragments);
    }
  });
});

// ---------------------------------------------------------------------------
// An `.mdx` path a code group discovers is an MDX source and a code source
// at once (SPEC 7.2; T2.1-2's `docs/EXTRA.mdx`): its MDX record carries the
// path's TypeScript declaration too (`ts`), judged above as plain
// TypeScript, and the builder stages the record under both declarations.

describe("S-9: an MDX record of a code-group `.mdx` path carries its TypeScript declaration too", () => {
  /** Well-formed MDX (an ESM block) and well-formed TypeScript alike. */
  const BOTH = "export {};" + LF;
  /** Well-formed MDX, ill-formed TypeScript. */
  const MDX_ONLY = doc('<S id="x">', "", "closed below", "", "</S>");

  test("registers well-formed or unparseable, or none; any other TypeScript declaration is refused", async () => {
    vi.resetModules();
    const ledger = await import("../helpers/staged-mdx.js");
    const a = ledger.stagedMdx("T0-9 a", BOTH, "well-formed", "well-formed");
    const b = ledger.stagedMdx(
      "T0-9 b",
      MDX_ONLY,
      "well-formed",
      "unparseable",
    );
    const c = ledger.stagedMdx("T0-9 c", BOTH);
    expect([a.ts, b.ts, c.ts]).toEqual([
      "well-formed",
      "unparseable",
      undefined,
    ]);
    expect(() =>
      ledger.stagedMdx(
        "T0-9 u",
        BOTH,
        "well-formed",
        "unchecked" as unknown as "well-formed",
      ),
    ).toThrow(/TypeScript declaration/);
    expect(ledger.stagedMdxLedger()).toEqual([a, b, c]);
  });

  test("the builder stages it under both declarations, at creation and by `file()`; a contradicting TypeScript declaration throws, nothing written", async () => {
    const { ledger, builder } = await freshBuilder();
    const code = ledger.stagedMdx(
      "T0-10 code",
      BOTH,
      "well-formed",
      "well-formed",
    );
    const wrong = ledger.stagedMdx(
      "T0-10 wrong",
      MDX_ONLY,
      "well-formed",
      "well-formed",
    );
    const unparseable = ledger.stagedMdx(
      "T0-10 unparseable",
      MDX_ONLY,
      "well-formed",
      "unparseable",
    );
    const workspace = await builder.TestWorkspace.create({
      files: { "docs/code.mdx": code, "docs/prose.mdx": unparseable },
    });
    onTestFinished(() => workspace.dispose());
    expect(text(await workspace.readBytes("docs/code.mdx"))).toBe(BOTH);
    expect(text(await workspace.readBytes("docs/prose.mdx"))).toBe(MDX_ONLY);
    await workspace.file("docs/later.mdx", code);
    expect(text(await workspace.readBytes("docs/later.mdx"))).toBe(BOTH);
    let thrown: unknown;
    try {
      await workspace.file("docs/wrong.mdx", wrong);
    } catch (error) {
      thrown = error;
    }
    expectTsStagingError(thrown, "docs/wrong.mdx", "declared well-formed");
    expect(await workspace.kind("docs/wrong.mdx")).toBe("absent");
    thrown = undefined;
    try {
      await workspace.file("docs/later.mdx", code, { ts: "well-formed" });
    } catch (error) {
      thrown = error;
    }
    expectTsStagingError(
      thrown,
      "docs/later.mdx",
      "contradiction",
      '"T0-10 code"',
    );
    thrown = undefined;
    try {
      const beside = await builder.TestWorkspace.create({
        files: { "docs/code.mdx": code },
        ts: { wellFormed: ["docs/code.mdx"] },
      });
      onTestFinished(() => beside.dispose());
    } catch (error) {
      thrown = error;
    }
    expectTsStagingError(
      thrown,
      "docs/code.mdx",
      "contradiction",
      "drop the declaration entry",
    );
  });
});
